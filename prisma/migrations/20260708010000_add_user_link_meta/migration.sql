-- CreateTable
CREATE TABLE `UserLinkMeta` (
    `id` VARCHAR(191) NOT NULL,
    `userLinkId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `title` TEXT NULL,
    `description` TEXT NULL,
    `imageUrl` TEXT NULL,
    `siteName` VARCHAR(191) NULL,
    `handle` VARCHAR(191) NULL,
    `extra` JSON NULL,
    `errorMessage` TEXT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserLinkMeta_userLinkId_key`(`userLinkId`),
    INDEX `UserLinkMeta_provider_idx`(`provider`),
    INDEX `UserLinkMeta_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserLinkMeta` ADD CONSTRAINT `UserLinkMeta_userLinkId_fkey` FOREIGN KEY (`userLinkId`) REFERENCES `UserLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
