-- AlterTable
ALTER TABLE `Comment`
  ADD COLUMN `parentCommentId` VARCHAR(191) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `type` ENUM('COMMENT_ON_POST', 'LIKE_ON_POST', 'FOLLOW', 'COMMENT_REPLY', 'COMMENT_MENTION') NOT NULL,
    `targetType` ENUM('POST', 'COMMENT', 'USER') NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    INDEX `Notification_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `Notification_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Comment_postId_parentCommentId_createdAt_idx` ON `Comment`(`postId`, `parentCommentId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Comment_parentCommentId_idx` ON `Comment`(`parentCommentId`);

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_parentCommentId_fkey` FOREIGN KEY (`parentCommentId`) REFERENCES `Comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
