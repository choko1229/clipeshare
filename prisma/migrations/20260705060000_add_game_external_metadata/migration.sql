ALTER TABLE `Game`
  ADD COLUMN `steamHeaderUrl` TEXT NULL,
  ADD COLUMN `steamCapsuleUrl` TEXT NULL,
  ADD COLUMN `rawgId` INTEGER NULL,
  ADD COLUMN `rawgBackgroundUrl` TEXT NULL,
  ADD COLUMN `metacriticScore` INTEGER NULL,
  ADD COLUMN `lastSteamSyncedAt` DATETIME(3) NULL,
  ADD COLUMN `lastRawgSyncedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `Game_rawgId_key` ON `Game`(`rawgId`);
