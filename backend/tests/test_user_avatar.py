"""The avatar column and the sniffing that guards what goes into it.

Built on an in-memory SQLite database created from the real ORM models, so a
column that does not exist - or one that is not deferred - fails here.
"""

import sys
import unittest
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, undefer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.a_db_config import Base, User, UserRole  # noqa: E402
from src.route.avatarRoute import MAX_AVATAR_SIZE, _sniff_image_type  # noqa: E402


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
GIF = b"GIF89a" + b"\x00" * 32
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 32


class AvatarSniffingTests(unittest.TestCase):
    def test_recognises_each_allowed_format(self):
        self.assertEqual(_sniff_image_type(PNG), "image/png")
        self.assertEqual(_sniff_image_type(JPEG), "image/jpeg")
        self.assertEqual(_sniff_image_type(GIF), "image/gif")
        self.assertEqual(_sniff_image_type(WEBP), "image/webp")

    def test_rejects_a_non_image(self):
        # A caller can claim image/png in the request; the bytes cannot.
        self.assertIsNone(_sniff_image_type(b"<svg onload=alert(1)>"))
        self.assertIsNone(_sniff_image_type(b"GIF89"))  # truncated magic number
        self.assertIsNone(_sniff_image_type(b""))

    def test_riff_alone_is_not_webp(self):
        self.assertIsNone(_sniff_image_type(b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 8))

    def test_cap_is_tighter_than_a_question_image(self):
        from src.route.teacherRoute.questionImageRoute import MAX_IMAGE_SIZE

        self.assertLess(MAX_AVATAR_SIZE, MAX_IMAGE_SIZE)


class AvatarStorageTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.session.add(
            User(
                school_id="T999",
                full_name="Avatar Tester",
                email="avatar@test.local",
                password_hash="x",
                role=UserRole.teacher,
            )
        )
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def _user(self, with_image=False):
        query = self.session.query(User).filter(User.school_id == "T999")
        if with_image:
            query = query.options(undefer(User.avatar_image))
        return query.first()

    def test_a_user_starts_without_an_avatar(self):
        user = self._user(with_image=True)
        self.assertIsNone(user.avatar_image)
        self.assertIsNone(user.avatar_mime)

    def test_round_trips_the_bytes(self):
        user = self._user()
        user.avatar_image = PNG
        user.avatar_mime = "image/png"
        self.session.commit()
        self.session.expunge_all()

        stored = self._user(with_image=True)
        self.assertEqual(stored.avatar_image, PNG)
        self.assertEqual(stored.avatar_mime, "image/png")

    def test_removal_clears_both_columns(self):
        user = self._user()
        user.avatar_image = JPEG
        user.avatar_mime = "image/jpeg"
        self.session.commit()

        user.avatar_image = None
        user.avatar_mime = None
        self.session.commit()
        self.session.expunge_all()

        stored = self._user(with_image=True)
        self.assertIsNone(stored.avatar_image)
        self.assertIsNone(stored.avatar_mime)

    def test_the_blob_is_deferred(self):
        # User is loaded on nearly every authenticated request. If the picture
        # joined the default SELECT, every one of them would carry it.
        compiled = str(select(User))
        self.assertIn("avatar_mime", compiled)
        self.assertNotIn("avatar_image", compiled)

    def test_the_mime_alone_answers_has_an_avatar(self):
        user = self._user()
        user.avatar_image = GIF
        user.avatar_mime = "image/gif"
        self.session.commit()
        self.session.expunge_all()

        # Loaded without undefer: the flag is known without reading the bytes.
        lean = self.session.query(User).filter(User.school_id == "T999").first()
        self.assertTrue(bool(lean.avatar_mime))


if __name__ == "__main__":
    unittest.main()
