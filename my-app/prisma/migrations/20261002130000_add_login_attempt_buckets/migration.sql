CREATE TABLE `login_attempt_buckets` (
    `key_hash` VARCHAR(64) NOT NULL,
    `failures` INTEGER NOT NULL DEFAULT 0,
    `window_started_at` DATETIME(3) NOT NULL,
    `blocked_until` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key_hash`),
    INDEX `login_attempt_buckets_blocked_until_idx` (`blocked_until`),
    INDEX `login_attempt_buckets_window_started_at_blocked_until_idx` (`window_started_at`, `blocked_until`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
