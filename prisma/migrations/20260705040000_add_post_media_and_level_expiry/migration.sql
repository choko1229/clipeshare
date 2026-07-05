ALTER TABLE `User`
  ADD COLUMN `accountLevelExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `levelProgressResetAt` DATETIME(3) NULL;

ALTER TABLE `AccountLevel`
  ADD COLUMN `promotionRule` JSON NULL;

CREATE TABLE `PostMedia` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `type` ENUM('CLIP', 'SCREENSHOT') NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `mediaUrl` TEXT NOT NULL,
    `thumbnailUrl` TEXT NULL,
    `originalPath` TEXT NULL,
    `processedPath` TEXT NULL,
    `fileSizeBytes` BIGINT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostMedia_postId_sortOrder_idx`(`postId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PostMedia` ADD CONSTRAINT `PostMedia_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
