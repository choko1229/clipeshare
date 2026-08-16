-- CreateTable
CREATE TABLE `QuickShare` (
    `id` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(191) NOT NULL,
    `deleteToken` VARCHAR(191) NOT NULL,
    `kind` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `mediaUrl` TEXT NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSizeBytes` BIGINT NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `userId` VARCHAR(191) NULL,
    `ipHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `QuickShare_publicId_key`(`publicId`),
    INDEX `QuickShare_expiresAt_deletedAt_idx`(`expiresAt`, `deletedAt`),
    INDEX `QuickShare_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `QuickShare_ipHash_createdAt_idx`(`ipHash`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuickShare` ADD CONSTRAINT `QuickShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
