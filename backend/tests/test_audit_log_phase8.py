"""Isolated concurrency and large-table verification for the Admin Audit Log."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import os
from time import perf_counter

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database import Base
from src.a_db_config import AuditLog, User, UserRole
from src.route.adminRoute import audit_log_stats, export_audit_logs, get_audit_log, list_audit_logs
from src.service.audit_service import begin_audit_request_context, record_audit, reset_audit_request_context


ROW_COUNT = 50_000
ADMIN = {"school_id": "A-P8", "role": "admin"}


def _user(school_id: str, role: UserRole, index: int = 0) -> User:
    return User(
        school_id=school_id,
        full_name=f"{role.value.title()} {index}",
        email=f"{school_id.lower()}@phase8.test",
        password_hash="x",
        role=role,
    )


@pytest.fixture()
def database(tmp_path):
    """Use a file database so separate sessions can exercise concurrent commits."""
    database_url = os.getenv("PHASE8_DATABASE_URL")
    if database_url:
        engine = create_engine(database_url, pool_size=16, max_overflow=16, pool_pre_ping=True)
        # The temporary MySQL database is already migrated; clear only this
        # suite's rows between tests rather than touching application tables.
        with engine.begin() as connection:
            connection.execute(AuditLog.__table__.delete())
            connection.execute(User.__table__.delete())
    else:
        engine = create_engine(
            f"sqlite:///{tmp_path / 'audit-phase8.sqlite'}",
            connect_args={"check_same_thread": False, "timeout": 30},
        )

        @event.listens_for(engine, "connect")
        def _sqlite_setup(connection, _):
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    session = sessions()
    session.add_all([
        _user("A-P8", UserRole.admin),
        _user("T-P8", UserRole.teacher),
        *[_user(f"S-P8-{index}", UserRole.student, index) for index in range(50)],
    ])
    session.commit()
    yield sessions
    session.close()
    engine.dispose()


def test_concurrent_mutations_keep_audit_and_request_context_isolated(database):
    def mutate(index: int) -> tuple[int, bool]:
        db = database()
        token = begin_audit_request_context(
            client_ip=f"198.51.100.{index + 1}", user_agent=f"phase8-agent/{index}"
        )
        succeeds = index < 40
        try:
            target = db.query(User).filter_by(school_id=f"S-P8-{index}").one()
            target.full_name = f"Mutated student {index}"
            actor = ADMIN if index % 2 == 0 else {"school_id": "T-P8", "role": "teacher"}
            record_audit(
                db,
                actor_school_id=actor["school_id"],
                actor_role=actor["role"],
                action="USER_UPDATED",
                entity_type="user",
                entity_id=target.school_id,
                metadata={"phase": 8, "mutation": index},
                request_id=f"phase8-request-{index}",
            )
            if succeeds:
                db.commit()
            else:
                db.rollback()
            return index, succeeds
        finally:
            reset_audit_request_context(token)
            db.close()

    with ThreadPoolExecutor(max_workers=10) as executor:
        outcomes = list(executor.map(mutate, range(50)))

    assert sum(succeeds for _, succeeds in outcomes) == 40
    db = database()
    rows = db.query(AuditLog).filter(AuditLog.request_id.like("phase8-request-%")).all()
    assert len(rows) == 40
    assert len({row.entity_id for row in rows}) == 40
    for row in rows:
        index = int(row.request_id.rsplit("-", 1)[1])
        assert row.entity_id == f"S-P8-{index}"
        assert row.actor_school_id == ("A-P8" if index % 2 == 0 else "T-P8")
        assert row.actor_role == ("admin" if index % 2 == 0 else "teacher")
        assert row.client_ip == f"198.51.100.{index + 1}"
        assert row.user_agent == f"phase8-agent/{index}"
    assert db.query(User).filter(User.full_name.like("Mutated student %")).count() == 40
    print("phase8 concurrency: attempted=50 successful=40 rolled_back=10 audits=40 duplicates=0 missing=0 context_mismatches=0")
    db.close()


def test_large_table_queries_export_cap_and_concurrent_reads(database):
    db = database()
    now = datetime.now()
    generated = []
    for index in range(ROW_COUNT):
        generated.append({
            "actor_school_id": "T-P8" if index % 3 else "A-P8",
            "actor_role": "teacher" if index % 3 else "admin",
            "action": "USER_CREATED" if index < 2_000 else "EXAM_UPDATED",
            "entity_type": "user" if index < 2_000 else "exam",
            "entity_id": f"phase8-{index}",
            "metadata_json": {"benchmark": "phase8"},
            "request_id": f"phase8-seed-{index}",
            "outcome": "FAILED" if index % 20 == 0 else "SUCCESS",
            "created_at": now - timedelta(minutes=index % 1_440),
        })
    db.execute(AuditLog.__table__.insert(), generated)
    db.commit()

    def timed(call):
        started = perf_counter()
        result = call()
        return result, perf_counter() - started

    calls = {
        "newest": lambda: list_audit_logs(page=1, page_size=25, current_user=ADMIN, role_check={}, db=db),
        "role": lambda: list_audit_logs(page=1, page_size=25, actor_role="teacher", current_user=ADMIN, role_check={}, db=db),
        "action": lambda: list_audit_logs(page=1, page_size=25, action="EXAM_UPDATED", current_user=ADMIN, role_check={}, db=db),
        "date": lambda: list_audit_logs(page=1, page_size=25, date_from=now - timedelta(hours=1), date_to=now, current_user=ADMIN, role_check={}, db=db),
        "search": lambda: list_audit_logs(page=1, page_size=25, search="phase8-499", current_user=ADMIN, role_check={}, db=db),
        "stats": lambda: audit_log_stats(ADMIN, {}, db),
    }
    results = {name: timed(call) for name, call in calls.items()}
    for name, (result, elapsed) in results.items():
        assert elapsed < 10, f"{name} query took {elapsed:.3f}s"
        if name != "stats":
            assert len(result["items"]) <= 25
    assert results["newest"][0]["total"] == ROW_COUNT
    assert results["stats"][0]["total_events"] == ROW_COUNT

    detail_id = results["newest"][0]["items"][0]["audit_log_id"]
    detail, detail_elapsed = timed(lambda: get_audit_log(detail_id, ADMIN, {}, db))
    assert detail_elapsed < 10 and detail["audit_log_id"] == detail_id
    with pytest.raises(HTTPException) as capped:
        export_audit_logs(current_user=ADMIN, role_check={}, db=db)
    assert capped.value.status_code == 422
    export, export_elapsed = timed(lambda: export_audit_logs(action="USER_CREATED", current_user=ADMIN, role_check={}, db=db))
    assert export_elapsed < 10 and export.body.startswith(b"Timestamp,")

    def write_audit(index: int) -> None:
        writer = database()
        try:
            record_audit(
                writer, actor_school_id="A-P8", actor_role="admin", action="USER_UPDATED",
                entity_type="user", entity_id=f"active-{index}", request_id=f"phase8-active-{index}",
            )
            writer.commit()
        finally:
            writer.close()

    with ThreadPoolExecutor(max_workers=5) as executor:
        writes = [executor.submit(write_audit, index) for index in range(25)]
        for _ in range(10):
            listed = list_audit_logs(page=1, page_size=25, actor_role="admin", current_user=ADMIN, role_check={}, db=db)
            assert listed["page"] == 1 and len(listed["items"]) <= 25
            assert audit_log_stats(ADMIN, {}, db)["total_events"] >= ROW_COUNT
        for write in writes:
            write.result()

    # MySQL's repeatable-read transaction keeps the reader's earlier snapshot;
    # an HTTP request uses a fresh session and must observe all committed writes.
    verification = database()
    assert verification.query(AuditLog).filter(AuditLog.request_id.like("phase8-active-%")).count() == 25
    verification.close()
    print(
        "phase8 50k seconds: "
        + ", ".join(f"{name}={elapsed:.4f}" for name, (_, elapsed) in results.items())
        + f", detail={detail_elapsed:.4f}, export={export_elapsed:.4f}, concurrent_reads=10, read_errors=0"
    )
    db.close()
