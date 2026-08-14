from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import AuditLog, User
from src.route.adminRoute import audit_log_actions, audit_log_stats, export_audit_logs, get_audit_log, list_audit_logs


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    session.add_all([
        User(school_id="A1", full_name="Admin", email="admin@audit.test", password_hash="x", role="admin"),
        User(school_id="T1", full_name="Teacher", email="teacher@audit.test", password_hash="x", role="teacher"),
        AuditLog(actor_school_id="T1", actor_role="teacher", action="EXAM_CREATED", entity_type="exam", entity_id="9", metadata_json={"safe": True, "password": "x"}, outcome="SUCCESS", created_at=datetime.now() - timedelta(days=1)),
        AuditLog(actor_school_id=None, actor_role="system", action="ANALYTICS_EVENT_RECORDED", entity_type="analytics", entity_id="1", outcome="SUCCESS", created_at=datetime.now()),
        AuditLog(actor_school_id="A1", actor_role="admin", action="USER_CREATED", entity_type="user", entity_id="=1", outcome="FAILED", created_at=datetime.now()),
    ])
    session.commit()
    yield session
    session.close()


def test_admin_audit_list_filters_detail_stats_and_csv(db):
    admin = {"school_id": "A1", "role": "admin"}
    listed = list_audit_logs(page=1, page_size=1, search="teacher", current_user=admin, role_check={}, db=db)
    assert listed["total"] == 1 and listed["items"][0]["actor"]["full_name"] == "Teacher"
    all_rows = list_audit_logs(page=1, page_size=25, outcome="FAILED", current_user=admin, role_check={}, db=db)
    assert all_rows["items"][0]["action"] == "USER_CREATED"
    detail = get_audit_log(all_rows["items"][0]["audit_log_id"], admin, {}, db)
    assert detail["metadata"] == {}
    teacher_row = list_audit_logs(page=1, page_size=25, action="EXAM_CREATED", current_user=admin, role_check={}, db=db)["items"][0]
    assert get_audit_log(teacher_row["audit_log_id"], admin, {}, db)["metadata"] == {"safe": True}
    assert audit_log_stats(admin, {}, db)["total_events"] == 2
    assert "EXAM_CREATED" in {item["code"] for item in audit_log_actions(admin, {}, db)["actions"]}
    csv = export_audit_logs(action="USER_CREATED", current_user=admin, role_check={}, db=db).body.decode()
    assert "'=1" in csv and "password" not in csv


def test_non_admin_and_hidden_rows_are_not_available(db):
    with pytest.raises(HTTPException) as denied:
        list_audit_logs(current_user={"school_id": "T1", "role": "teacher"}, role_check={}, db=db)
    assert denied.value.status_code == 403
    hidden = db.query(AuditLog).filter_by(action="ANALYTICS_EVENT_RECORDED").one()
    with pytest.raises(HTTPException) as missing:
        get_audit_log(hidden.audit_log_id, {"school_id": "A1", "role": "admin"}, {}, db)
    assert missing.value.status_code == 404
