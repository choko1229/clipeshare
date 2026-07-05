ALTER TABLE `AccountLevel`
  ADD COLUMN `levelColor` VARCHAR(191) NOT NULL DEFAULT '#8b949e',
  ADD COLUMN `maxImagesPerPost` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `minPostCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `minAccountAgeDays` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `minFollowerCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `isManualOnly` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `AccountLevel_sortOrder_idx` ON `AccountLevel`(`sortOrder`);
CREATE INDEX `AccountLevel_isDefault_idx` ON `AccountLevel`(`isDefault`);
