-- AlterTable
ALTER TABLE `User`
  ADD COLUMN `discordAutoMirrorEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Notification`
  MODIFY `type` ENUM('COMMENT_ON_POST', 'LIKE_ON_POST', 'FOLLOW', 'COMMENT_REPLY', 'COMMENT_MENTION', 'DISCORD_MIRROR_SAVED') NOT NULL;

-- AlterTable
ALTER TABLE `Post`
  ADD COLUMN `sourceDiscordGuildId` VARCHAR(191) NULL,
  ADD COLUMN `sourceDiscordMessageId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Post_sourceDiscordMessageId_key` ON `Post`(`sourceDiscordMessageId`);

-- CreateTable
CREATE TABLE `DiscordGuildLink` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(191) NOT NULL,
    `guildName` VARCHAR(191) NULL,
    `defaultGameId` VARCHAR(191) NULL,
    `watchedChannelIds` JSON NULL,
    `installedByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DiscordGuildLink_guildId_key`(`guildId`),
    INDEX `DiscordGuildLink_defaultGameId_idx`(`defaultGameId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiscordGuildLink` ADD CONSTRAINT `DiscordGuildLink_installedByUserId_fkey` FOREIGN KEY (`installedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscordGuildLink` ADD CONSTRAINT `DiscordGuildLink_defaultGameId_fkey` FOREIGN KEY (`defaultGameId`) REFERENCES `Game`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
