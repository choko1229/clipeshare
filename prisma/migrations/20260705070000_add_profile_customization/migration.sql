ALTER TABLE `User`
  ADD COLUMN `profileHeaderUrl` TEXT NULL,
  ADD COLUMN `profileBackgroundUrl` TEXT NULL,
  ADD COLUMN `profileAccentColor` VARCHAR(191) NULL,
  ADD COLUMN `profileButtonColor` VARCHAR(191) NULL;
