"""The forgot-password flow: OTP issue, verification, and the reset itself.

Built on an in-memory SQLite database created from the real ORM models, so a
column or constraint that does not exist fails here.
"""

import sys
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.a_db_config import PasswordResetOtp, User, UserRole  # noqa: E402
from src.service import password_reset_service as prs  # noqa: E402


class PasswordResetTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        from src.a_db_config import Base

        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(
            school_id="S000001",
            full_name="Test Student",
            email="Student@Example.com",
            password_hash=generate_password_hash("OldPass1!"),
            role=UserRole.student,
        )
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _issue(self, email="student@example.com"):
        """Request a code, bypassing the resend cooldown between calls."""
        with patch.object(prs, "RESEND_COOLDOWN", timedelta(seconds=0)):
            return prs.request_otp(self.db, email)

    def _row(self):
        return self.db.query(PasswordResetOtp).order_by(PasswordResetOtp.id.desc()).first()


class RequestOtpTests(PasswordResetTestCase):
    def test_issues_a_six_digit_code_and_stores_only_its_hash(self):
        issued = self._issue()
        self.assertIsNotNone(issued)
        self.assertEqual(len(issued.otp), 6)
        self.assertTrue(issued.otp.isdigit())

        row = self._row()
        self.assertNotIn(issued.otp, row.otp_hash)
        self.assertEqual(row.otp_hash, prs.hash_otp(issued.otp))
        self.assertEqual(row.attempts, 0)
        self.assertIsNone(row.consumed_at)

    def test_the_code_expires_three_minutes_after_generation(self):
        issued = self._issue()
        row = self._row()
        self.assertEqual(row.expires_at - row.created_at, timedelta(minutes=3))
        self.assertEqual(issued.expires_at, row.expires_at)

    def test_matches_the_address_regardless_of_case(self):
        self.assertIsNotNone(self._issue("STUDENT@EXAMPLE.COM"))

    def test_an_unknown_address_issues_nothing(self):
        self.assertIsNone(self._issue("nobody@example.com"))
        self.assertEqual(self.db.query(PasswordResetOtp).count(), 0)

    def test_a_locked_account_issues_nothing(self):
        # Otherwise a reset would be a way back in without an admin unlocking.
        self.user.is_locked = True
        self.db.commit()
        self.assertIsNone(self._issue())

    def test_a_deleted_account_issues_nothing(self):
        from datetime import datetime

        self.user.deleted_at = datetime.utcnow()
        self.db.commit()
        self.assertIsNone(self._issue())

    def test_a_resend_kills_the_previous_code(self):
        first = self._issue()
        self._issue()
        # Two live codes would mean the old one still worked for its full three
        # minutes after the user asked for a replacement.
        with self.assertRaises(prs.PasswordResetError):
            prs.verify_otp(self.db, "student@example.com", first.otp)

    def test_the_cooldown_blocks_an_immediate_resend(self):
        self.assertIsNotNone(prs.request_otp(self.db, "student@example.com"))
        self.assertIsNone(prs.request_otp(self.db, "student@example.com"))

    def test_the_window_caps_how_many_codes_one_account_gets(self):
        for _ in range(prs.MAX_SENDS_PER_WINDOW):
            self.assertIsNotNone(self._issue())
        self.assertIsNone(self._issue())


class VerifyOtpTests(PasswordResetTestCase):
    def test_a_correct_code_returns_a_token(self):
        issued = self._issue()
        token, expires_at = prs.verify_otp(self.db, "student@example.com", issued.otp)
        self.assertTrue(token)
        row = self._row()
        self.assertEqual(row.reset_token_hash, prs.hash_reset_token(token))
        self.assertEqual(row.reset_token_expires_at, expires_at)

    def test_a_correct_code_is_consumed_immediately(self):
        issued = self._issue()
        prs.verify_otp(self.db, "student@example.com", issued.otp)
        self.assertIsNotNone(self._row().consumed_at)
        # Replaying it finds a dead row.
        with self.assertRaises(prs.PasswordResetError):
            prs.verify_otp(self.db, "student@example.com", issued.otp)

    def test_a_wrong_code_is_rejected_and_counted(self):
        issued = self._issue()
        wrong = "000000" if issued.otp != "000000" else "111111"
        with self.assertRaises(prs.PasswordResetError):
            prs.verify_otp(self.db, "student@example.com", wrong)
        self.assertEqual(self._row().attempts, 1)

    def test_an_expired_code_is_rejected(self):
        issued = self._issue()
        row = self._row()
        row.expires_at = row.created_at - timedelta(seconds=1)
        self.db.commit()
        with self.assertRaises(prs.PasswordResetError):
            prs.verify_otp(self.db, "student@example.com", issued.otp)

    def test_the_fifth_wrong_attempt_kills_the_code(self):
        issued = self._issue()
        wrong = "000000" if issued.otp != "000000" else "111111"
        for _ in range(prs.MAX_VERIFY_ATTEMPTS):
            with self.assertRaises(prs.PasswordResetError):
                prs.verify_otp(self.db, "student@example.com", wrong)

        row = self._row()
        self.assertEqual(row.attempts, prs.MAX_VERIFY_ATTEMPTS)
        self.assertIsNotNone(row.consumed_at)
        # Even the right code is worthless now.
        with self.assertRaises(prs.PasswordResetError):
            prs.verify_otp(self.db, "student@example.com", issued.otp)

    def test_an_unknown_address_fails_like_a_wrong_code(self):
        # Identical messages, or the endpoint tells an attacker which addresses
        # are registered.
        issued = self._issue()
        with self.assertRaises(prs.PasswordResetError) as unknown:
            prs.verify_otp(self.db, "nobody@example.com", issued.otp)
        wrong = "000000" if issued.otp != "000000" else "111111"
        with self.assertRaises(prs.PasswordResetError) as bad_code:
            prs.verify_otp(self.db, "student@example.com", wrong)
        self.assertEqual(str(unknown.exception), str(bad_code.exception))


class ResetPasswordTests(PasswordResetTestCase):
    def _token(self):
        issued = self._issue()
        token, _ = prs.verify_otp(self.db, "student@example.com", issued.otp)
        return token

    def test_sets_the_new_password_with_the_projects_hashing(self):
        token = self._token()
        prs.reset_password(self.db, token, "NewPass1!")
        self.db.refresh(self.user)
        self.assertTrue(check_password_hash(self.user.password_hash, "NewPass1!"))
        self.assertFalse(check_password_hash(self.user.password_hash, "OldPass1!"))

    def test_the_token_dies_with_the_reset(self):
        token = self._token()
        prs.reset_password(self.db, token, "NewPass1!")
        row = self._row()
        self.assertIsNotNone(row.reset_completed_at)
        self.assertIsNone(row.reset_token_hash)
        with self.assertRaises(prs.PasswordResetError):
            prs.reset_password(self.db, token, "Another1!")

    def test_an_expired_token_is_rejected(self):
        from datetime import datetime

        token = self._token()
        row = self._row()
        row.reset_token_expires_at = datetime.utcnow() - timedelta(seconds=1)
        self.db.commit()
        with self.assertRaises(prs.PasswordResetError):
            prs.reset_password(self.db, token, "NewPass1!")

    def test_an_invented_token_is_rejected(self):
        with self.assertRaises(prs.PasswordResetError):
            prs.reset_password(self.db, "not-a-real-token", "NewPass1!")

    def test_a_weak_password_is_refused_and_the_token_survives(self):
        token = self._token()
        with self.assertRaises(prs.PasswordResetError) as refused:
            prs.reset_password(self.db, token, "weak")
        self.assertTrue(getattr(refused.exception, "issues", None))
        # A typo must not cost the user their token.
        prs.reset_password(self.db, token, "NewPass1!")
        self.db.refresh(self.user)
        self.assertTrue(check_password_hash(self.user.password_hash, "NewPass1!"))


class HashingTests(unittest.TestCase):
    def test_the_otp_hash_is_keyed(self):
        import hashlib

        # A plain digest of six digits falls to a million-guess sweep of a
        # stolen table; the keyed hash does not match one.
        self.assertNotEqual(prs.hash_otp("123456"), hashlib.sha256(b"123456").hexdigest())

    def test_generated_codes_are_six_digits_including_leading_zeros(self):
        for _ in range(200):
            code = prs.generate_otp()
            self.assertEqual(len(code), 6)
            self.assertTrue(code.isdigit())


if __name__ == "__main__":
    unittest.main()
