-- Adds an optional avatar picture to a user.
--
-- Additive only: no table is dropped and no existing row is touched. Safe to run
-- against a live database. Re-running it fails on the duplicate column, which is
-- why the check below is separate rather than an IF NOT EXISTS.
--
--   mysql -u <user> -p <database> < 2026-08-22_user_avatar.sql
--
-- Check first (returns 2 once applied, 0 before):
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user'
--      AND COLUMN_NAME IN ('avatar_image', 'avatar_mime');

ALTER TABLE `user`
    -- MEDIUMBLOB holds up to 16 MB; the API caps uploads far below that.
    -- The column is deferred in the ORM, so ordinary user queries never read it.
    ADD COLUMN `avatar_image` MEDIUMBLOB NULL AFTER `date_of_birth`,
    -- Non-null exactly when an avatar is stored, so "has an avatar" and the
    -- Content-Type to serve it with are both known without reading the blob.
    ADD COLUMN `avatar_mime` VARCHAR(100) NULL AFTER `avatar_image`;

-- Rollback:
-- ALTER TABLE `user`
--     DROP COLUMN `avatar_mime`,
--     DROP COLUMN `avatar_image`;
