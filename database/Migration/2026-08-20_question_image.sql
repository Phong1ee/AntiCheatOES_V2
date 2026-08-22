-- Adds an optional image to a question.
--
-- Additive only: no table is dropped and no existing row is touched. Safe to run
-- against a live database. Re-running it fails on the duplicate column, which is
-- why the check below is separate rather than an IF NOT EXISTS.
--
--   mysql -u <user> -p <database> < 2026-08-20_question_image.sql
--
-- Check first (returns 2 once applied, 0 before):
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'question'
--      AND COLUMN_NAME IN ('question_image', 'question_image_mime');

ALTER TABLE `question`
    -- MEDIUMBLOB holds up to 16 MB; the API caps uploads well below that.
    ADD COLUMN `question_image` MEDIUMBLOB NULL AFTER `question_status`,
    -- Non-null exactly when an image is stored, so "has an image" and the
    -- Content-Type to serve it with are both known without reading the blob.
    ADD COLUMN `question_image_mime` VARCHAR(100) NULL AFTER `question_image`;

-- Rollback:
-- ALTER TABLE `question`
--     DROP COLUMN `question_image_mime`,
--     DROP COLUMN `question_image`;
