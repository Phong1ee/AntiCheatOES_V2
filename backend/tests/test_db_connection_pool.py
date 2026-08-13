import os
import unittest
from unittest.mock import MagicMock, patch

from mysql.connector.errors import PoolError

from src.a_db_config import config
from src.models import userModel


class DbConnectionPoolTests(unittest.TestCase):
    def setUp(self):
        self.environment = {
            "DB_POOL_NAME": "test_oes_pool",
            "DB_POOL_SIZE": "3",
            "DB_CONNECT_TIMEOUT": "7",
            "DB_HOST": "db.example.test",
            "DB_PORT": "3307",
            "DB_NAME": "oes_test",
            "DB_USER": "test_user",
            "DB_PASSWORD": "test_password",
        }
        config._connection_pool = None

    def tearDown(self):
        config._connection_pool = None

    def test_repeated_borrow_and_close_uses_one_pool(self):
        connection = MagicMock()
        pool = MagicMock()
        pool.get_connection.return_value = connection

        with patch.dict(os.environ, self.environment), patch.object(
            config.pooling, "MySQLConnectionPool", return_value=pool
        ) as create_pool:
            for _ in range(10):
                borrowed = config.get_db_connection()
                borrowed.close()

        create_pool.assert_called_once_with(
            pool_name="test_oes_pool",
            pool_size=3,
            pool_reset_session=True,
            user="test_user",
            password="test_password",
            host="db.example.test",
            port=3307,
            database="oes_test",
            connection_timeout=7,
        )
        self.assertEqual(pool.get_connection.call_count, 10)
        self.assertEqual(connection.close.call_count, 10)

    def test_pool_exhaustion_is_returned_as_pool_error(self):
        pool = MagicMock()
        pool.get_connection.side_effect = PoolError("pool exhausted")

        with patch.dict(os.environ, self.environment), patch.object(
            config.pooling, "MySQLConnectionPool", return_value=pool
        ), patch("builtins.print"):
            with self.assertRaisesRegex(PoolError, "pool exhausted"):
                config.get_db_connection()

    def test_pool_exhaustion_retries_for_the_configured_bounded_window(self):
        pool = MagicMock()
        connection = MagicMock()
        pool.get_connection.side_effect = [PoolError("pool exhausted"), connection]

        with patch.dict(os.environ, {**self.environment, "DB_POOL_ACQUIRE_TIMEOUT": "1"}), patch.object(
            config.pooling, "MySQLConnectionPool", return_value=pool
        ), patch.object(config.time, "sleep") as sleep:
            borrowed = config.get_db_connection()

        self.assertIs(borrowed, connection)
        sleep.assert_called_once()

    def test_generate_school_id_returns_borrowed_connection(self):
        cursor = MagicMock()
        cursor.fetchone.return_value = (12,)
        connection = MagicMock()
        connection.cursor.return_value = cursor

        with patch.object(userModel, "get_db_connection", return_value=connection):
            self.assertEqual(userModel.generate_school_id("student"), "S000013")

        cursor.close.assert_called_once_with()
        connection.close.assert_called_once_with()
