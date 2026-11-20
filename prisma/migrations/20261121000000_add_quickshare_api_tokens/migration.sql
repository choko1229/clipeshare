-- Clipshare Quick: API トークン・ブラウザ認可・レベル別クイック共有上限
-- 追加のみ(既存テーブルの列削除・型変更なし)。ロールバック SQL は docs/DEPLOY_QUICKSHARE.md を参照。

-- AlterTable
ALTER TABLE `AccountLevel` ADD COLUMN `quickShareImageMaxBytes` BIGINT NULL,
    ADD COLUMN `quickShareVideoMaxBytes` BIGINT NULL;

-- AlterTable
ALTER TABLE `QuickShare` ADD COLUMN `apiTokenId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ApiToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `platform` VARCHAR(32) NULL,
    `clientVersion` VARCHAR(32) NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `prefix` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NULL,
    `lastUsedIpHash` CHAR(64) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedReason` ENUM('USER', 'SELF', 'ADMIN', 'CODE_REUSE') NULL,

    UNIQUE INDEX `ApiToken_tokenHash_key`(`tokenHash`),
    INDEX `ApiToken_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `ApiToken_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiAuthorization` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(64) NOT NULL,
    `redirectUri` VARCHAR(255) NOT NULL,
    `state` VARCHAR(256) NOT NULL,
    `codeChallenge` VARCHAR(64) NOT NULL,
    `connectionCode` VARCHAR(7) NOT NULL,
    `deviceName` VARCHAR(64) NOT NULL,
    `devicePlatform` VARCHAR(32) NULL,
    `csrfTokenHash` CHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DENIED') NOT NULL DEFAULT 'PENDING',
    `codeHash` CHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `decidedAt` DATETIME(3) NULL,
    `codeExpiresAt` DATETIME(3) NULL,
    `usedAt` DATETIME(3) NULL,
    `apiTokenId` VARCHAR(191) NULL,

    UNIQUE INDEX `ApiAuthorization_codeChallenge_key`(`codeChallenge`),
    UNIQUE INDEX `ApiAuthorization_codeHash_key`(`codeHash`),
    UNIQUE INDEX `ApiAuthorization_apiTokenId_key`(`apiTokenId`),
    INDEX `ApiAuthorization_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ApiAuthorization_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `QuickShare_apiTokenId_createdAt_idx` ON `QuickShare`(`apiTokenId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `QuickShare` ADD CONSTRAINT `QuickShare_apiTokenId_fkey` FOREIGN KEY (`apiTokenId`) REFERENCES `ApiToken`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiToken` ADD CONSTRAINT `ApiToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiAuthorization` ADD CONSTRAINT `ApiAuthorization_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiAuthorization` ADD CONSTRAINT `ApiAuthorization_apiTokenId_fkey` FOREIGN KEY (`apiTokenId`) REFERENCES `ApiToken`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Data: 画像上限 20MB -> 50MB(SPEC 確定事項)。旧既定値のまま保存されている場合のみ更新し、
-- 管理者が別の値を設定している場合は変更しない。
UPDATE `SiteSetting`
SET `value` = '50000000', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` = 'quick_share_max_image_bytes' AND `value` = '20000000';

-- Data: 既存レベルに現行のログイン時上限(=サイト全体のクイック共有設定の現在値)をコピーする。
-- 設定行が無い/不正な値のときはコード上の既定値(画像 50MB / 動画 200MB)を使う。
UPDATE `AccountLevel`
SET
  `quickShareImageMaxBytes` = COALESCE(
    (SELECT CAST(`value` AS UNSIGNED) FROM `SiteSetting`
      WHERE `key` = 'quick_share_max_image_bytes' AND `value` REGEXP '^[1-9][0-9]{0,14}$'),
    50000000
  ),
  `quickShareVideoMaxBytes` = COALESCE(
    (SELECT CAST(`value` AS UNSIGNED) FROM `SiteSetting`
      WHERE `key` = 'quick_share_max_video_bytes' AND `value` REGEXP '^[1-9][0-9]{0,14}$'),
    200000000
  )
WHERE `quickShareImageMaxBytes` IS NULL AND `quickShareVideoMaxBytes` IS NULL;
