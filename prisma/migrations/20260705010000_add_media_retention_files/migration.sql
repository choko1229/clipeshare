CREATE TABLE `MediaRetentionFile` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NULL,
    `path` TEXT NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `deleteAfter` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MediaRetentionFile_deleteAfter_deletedAt_idx`(`deleteAfter`, `deletedAt`),
    INDEX `MediaRetentionFile_postId_idx`(`postId`),
    INDEX `MediaRetentionFile_reason_idx`(`reason`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MediaRetentionFile` ADD CONSTRAINT `MediaRetentionFile_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
