-- AlterTable
ALTER TABLE `Report`
  MODIFY `targetType` ENUM('POST', 'COMMENT', 'USER', 'LIVE_STREAM') NOT NULL;

-- AlterTable
ALTER TABLE `Notification`
  MODIFY `type` ENUM('COMMENT_ON_POST', 'LIKE_ON_POST', 'FOLLOW', 'COMMENT_REPLY', 'COMMENT_MENTION', 'DISCORD_MIRROR_SAVED', 'LIVE_STREAM_STARTED') NOT NULL,
  MODIFY `targetType` ENUM('POST', 'COMMENT', 'USER', 'LIVE_STREAM') NOT NULL;

-- CreateTable
CREATE TABLE `LiveStream` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `streamKey` VARCHAR(191) NOT NULL,
    `viewToken` VARCHAR(191) NOT NULL,
    `visibility` ENUM('PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `status` ENUM('OFFLINE', 'LIVE') NOT NULL DEFAULT 'OFFLINE',
    `disconnectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LiveStream_userId_key`(`userId`),
    UNIQUE INDEX `LiveStream_streamKey_key`(`streamKey`),
    UNIQUE INDEX `LiveStream_viewToken_key`(`viewToken`),
    INDEX `LiveStream_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveSession` (
    `id` VARCHAR(191) NOT NULL,
    `liveStreamId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `likeCount` INTEGER NOT NULL DEFAULT 0,

    INDEX `LiveSession_liveStreamId_startedAt_idx`(`liveStreamId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `liveSessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('PROCESSING', 'PUBLISHED', 'PRIVATE', 'HIDDEN', 'FAILED', 'DELETED') NOT NULL DEFAULT 'PUBLISHED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LiveChatMessage_liveSessionId_createdAt_idx`(`liveSessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveLike` (
    `userId` VARCHAR(191) NOT NULL,
    `liveSessionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `liveSessionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LiveStream` ADD CONSTRAINT `LiveStream_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveSession` ADD CONSTRAINT `LiveSession_liveStreamId_fkey` FOREIGN KEY (`liveStreamId`) REFERENCES `LiveStream`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveChatMessage` ADD CONSTRAINT `LiveChatMessage_liveSessionId_fkey` FOREIGN KEY (`liveSessionId`) REFERENCES `LiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveChatMessage` ADD CONSTRAINT `LiveChatMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveLike` ADD CONSTRAINT `LiveLike_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveLike` ADD CONSTRAINT `LiveLike_liveSessionId_fkey` FOREIGN KEY (`liveSessionId`) REFERENCES `LiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
