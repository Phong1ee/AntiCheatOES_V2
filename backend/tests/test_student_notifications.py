import unittest
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from src.a_db_config import Notification, NotificationType, User
from src.route.studentRoute.notificationRoute import (
    get_notifications,
    mark_all_read,
    mark_one_read,
)
from src.service.notification_service import create_notification, create_notifications, get_unread_count


class StudentNotificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        event.listen(
            cls.engine,
            "connect",
            lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"),
        )
        cls.Session = sessionmaker(bind=cls.engine, expire_on_commit=False)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.db.add_all(
            [
                User(school_id="S1", full_name="Student One", email="s1@test", password_hash="x", role="student"),
                User(school_id="S2", full_name="Student Two", email="s2@test", password_hash="x", role="student"),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    @staticmethod
    def _student(school_id: str) -> dict:
        return {"school_id": school_id, "role": "student"}

    def _notification(self, student_id: str, *, created_at: datetime | None = None, is_read: bool = False):
        notification = create_notification(
            self.db,
            student_id=student_id,
            notification_type=NotificationType.NEW_EXAM_ASSIGNED,
            title="New Exam Assigned",
            message="You have a new exam.",
        )
        if created_at:
            notification.created_at = created_at
        notification.is_read = is_read
        self.db.commit()
        return notification

    def test_get_returns_only_authenticated_students_notifications_and_unread_count(self):
        own = self._notification("S1")
        self._notification("S2")

        response = get_notifications(self._student("S1"), {}, self.db)

        self.assertEqual([item.notification_id for item in response.notifications], [own.notification_id])
        self.assertEqual(response.unread_count, 1)

    def test_student_cannot_read_or_mark_another_students_notification(self):
        other = self._notification("S2")

        response = get_notifications(self._student("S1"), {}, self.db)
        self.assertEqual(response.notifications, [])
        with self.assertRaises(HTTPException) as error:
            mark_one_read(other.notification_id, self._student("S1"), {}, self.db)

        self.assertEqual(error.exception.status_code, 404)
        self.assertFalse(self.db.get(Notification, other.notification_id).is_read)

    def test_mark_one_read_updates_only_that_notification(self):
        notification = self._notification("S1")

        response = mark_one_read(notification.notification_id, self._student("S1"), {}, self.db)

        self.assertTrue(response.is_read)
        self.assertTrue(self.db.get(Notification, notification.notification_id).is_read)
        self.assertEqual(get_unread_count(self.db, "S1"), 0)

    def test_mark_all_read_updates_only_authenticated_student(self):
        self._notification("S1")
        self._notification("S1")
        other = self._notification("S2")

        response = mark_all_read(self._student("S1"), {}, self.db)

        self.assertEqual(response.updated_count, 2)
        self.assertEqual(response.unread_count, 0)
        self.assertEqual(get_unread_count(self.db, "S1"), 0)
        self.assertFalse(self.db.get(Notification, other.notification_id).is_read)

    def test_notifications_are_newest_first(self):
        now = datetime.now()
        older = self._notification("S1", created_at=now - timedelta(minutes=2))
        newer = self._notification("S1", created_at=now - timedelta(minutes=1))

        response = get_notifications(self._student("S1"), {}, self.db)

        self.assertEqual([item.notification_id for item in response.notifications], [newer.notification_id, older.notification_id])

    def test_bulk_create_stages_one_row_per_distinct_student_without_committing(self):
        notifications = create_notifications(
            self.db,
            student_ids=["S1", "S2", "S1"],
            notification_type=NotificationType.EXAM_CODE_CHANGED,
            title="Exam Code Changed",
            message="The access code changed.",
        )

        self.assertEqual([item.student_id for item in notifications], ["S1", "S2"])
        self.assertTrue(all(item.notification_id is None for item in notifications))
        self.db.rollback()
        self.assertEqual(self.db.query(Notification).count(), 0)


if __name__ == "__main__":
    unittest.main()
