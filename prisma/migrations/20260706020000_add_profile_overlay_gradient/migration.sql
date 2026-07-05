ALTER TABLE `User`
  ADD COLUMN `profileOverlayColorEnd` VARCHAR(191) NULL,
  ADD COLUMN `profileOverlayOpacity` INTEGER NOT NULL DEFAULT 70;
