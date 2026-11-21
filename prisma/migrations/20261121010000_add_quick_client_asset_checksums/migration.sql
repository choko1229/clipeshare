-- Clipshare Quick: 配布ファイルの SHA-256 の手動登録(追加のみ)

-- CreateTable
CREATE TABLE `QuickClientAssetChecksum` (
    `id` VARCHAR(191) NOT NULL,
    `repo` VARCHAR(140) NOT NULL,
    `tag` VARCHAR(100) NOT NULL,
    `assetName` VARCHAR(255) NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `createdByAdminId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuickClientAssetChecksum_repo_tag_assetName_key`(`repo`, `tag`, `assetName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

