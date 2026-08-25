import os
import time
from threading import Lock

from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling

load_dotenv()


_connection_pool: pooling.MySQLConnectionPool | None = None
_pool_lock = Lock()


def _positive_int_env(name: str, default: int) -> int:
    value = os.getenv(name, str(default))
    try:
        parsed = int(value)
    except ValueError as err:
        raise ValueError(f"{name} must be a positive integer") from err

    if parsed < 1:
        raise ValueError(f"{name} must be a positive integer")
    return parsed


def _non_negative_float_env(name: str, default: float) -> float:
    value = os.getenv(name, str(default))
    try:
        parsed = float(value)
    except ValueError as err:
        raise ValueError(f"{name} must be a non-negative number") from err
    if parsed < 0:
        raise ValueError(f"{name} must be a non-negative number")
    return parsed


def _get_connection_pool() -> pooling.MySQLConnectionPool:
    """Create the mysql-connector pool once for this API process."""
    global _connection_pool
    if _connection_pool is None:
        with _pool_lock:
            if _connection_pool is None:
                _connection_pool = pooling.MySQLConnectionPool(
                    pool_name=os.getenv("DB_POOL_NAME", "oes_api_pool"),
                    pool_size=_positive_int_env("DB_POOL_SIZE", 5),
                    pool_reset_session=True,
                    user=os.getenv("DB_USER", "root"),
                    password=os.getenv("DB_PASSWORD", ""),
                    host=os.getenv("DB_HOST", "localhost"),
                    port=_positive_int_env("DB_PORT", 3306),
                    database=os.getenv("DB_NAME", "online_exam_db"),
                    charset="utf8mb4",
                    collation="utf8mb4_0900_ai_ci",
                    connection_timeout=_positive_int_env("DB_CONNECT_TIMEOUT", 5),
                )
    return _connection_pool


def get_db_connection():
    acquire_timeout = _non_negative_float_env("DB_POOL_ACQUIRE_TIMEOUT", 0)
    deadline = time.monotonic() + acquire_timeout
    try:
        while True:
            try:
                # PooledMySQLConnection.close() returns this borrowed connection
                # to the pool. mysql-connector has no blocking checkout option,
                # so a bounded retry prevents a transient burst from becoming an
                # immediate HTTP failure without growing the pool.
                return _get_connection_pool().get_connection()
            except mysql.connector.errors.PoolError:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(min(0.01, max(0, deadline - time.monotonic())))
    except mysql.connector.Error as err:
        print(f"Error connecting to database: {err}")
        raise
