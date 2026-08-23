-- Password reset by emailed one-time code.
--
-- Additive only: creates one new table, touches no existing table and no
-- existing row. Safe to run against a live database.
--
--   mysql -u <user> -p <database> < 2026-08-23_password_reset_otp.sql
--
-- Check first (returns 1 once applied, 0 before):
--   SELECT COUNT(*) FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_otp';

CREATE TABLE IF NOT EXISTS `password_reset_otp` (
    `id`                     INT          NOT NULL AUTO_INCREMENT,
    `user_id`                INT          NOT NULL,
    -- HMAC-SHA256 of the six-digit code, keyed with the application secret.
    -- Never the code itself: a plain digest of six digits is brute-forced from
    -- a dump in milliseconds, an HMAC without the key is not.
    `otp_hash`               VARCHAR(64)  NOT NULL,
    `expires_at`             DATETIME     NOT NULL,
    `attempts`               INT          NOT NULL DEFAULT 0,
    `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Set when the code is used, missed too often, or superseded by a resend.
    -- This is what makes a code single-use.
    `consumed_at`            DATETIME     NULL,
    -- SHA-256 of the reset token handed out after a correct code. The token is
    -- 256 bits of randomness, so a plain digest is sufficient here.
    `reset_token_hash`       VARCHAR(64)  NULL,
    `reset_token_expires_at` DATETIME     NULL,
    -- Set once the password actually changed, which retires the token.
    `reset_completed_at`     DATETIME     NULL,
    PRIMARY KEY (`id`),
    KEY `ix_password_reset_otp_user_created` (`user_id`, `created_at`),
    KEY `ix_password_reset_otp_token` (`reset_token_hash`),
    CONSTRAINT `ck_password_reset_otp_attempts_nonnegative` CHECK (`attempts` >= 0),
    CONSTRAINT `fk_password_reset_otp_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rollback:
-- DROP TABLE `password_reset_otp`;
