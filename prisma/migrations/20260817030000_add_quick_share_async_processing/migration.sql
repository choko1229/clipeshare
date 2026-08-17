-- AlterTable
ALTER TABLE `QuickShare`
  ADD COLUMN `status` ENUM('PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'READY',
  ADD COLUMN `thumbnailUrl` TEXT NULL,
  ADD COLUMN `originalPath` TEXT NULL,
  ADD COLUMN `errorMessage` TEXT NULL,
  MODIFY `mediaUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `UploadJob`
  MODIFY `postId` VARCHAR(191) NULL,
  ADD COLUMN `quickShareId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `UploadJob_quickShareId_idx` ON `UploadJob`(`quickShareId`);

-- AddForeignKey
ALTER TABLE `UploadJob` ADD CONSTRAINT `UploadJob_quickShareId_fkey` FOREIGN KEY (`quickShareId`) REFERENCES `QuickShare`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
