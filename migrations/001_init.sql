-- Gift Vault PHP schema, version 1.
-- Mirrors the runtime Prisma schema that shipped with Gift Vault 1.x,
-- including the dormant price-tracking tables so no historic data is lost.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_usedById_key" ON "Invitation"("usedById");
CREATE INDEX IF NOT EXISTS "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#D9A3B0',
    "icon" TEXT NOT NULL DEFAULT 'Tag',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_name_key" ON "Category" ("userId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_slug_key" ON "Category" ("userId", "slug");

CREATE TABLE IF NOT EXISTS "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Store_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Store_userId_domain_key" ON "Store"("userId", "domain");

CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tag_userId_name_key" ON "Tag" ("userId", "name");

CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "description" TEXT,
    "imagePath" TEXT,
    "imageSourceUrl" TEXT,
    "currentPrice" REAL,
    "originalPrice" REAL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "availability" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TO_CONSIDER',
    "notes" TEXT,
    "autoTrack" BOOLEAN NOT NULL DEFAULT true,
    "storeId" TEXT,
    "categoryId" TEXT NOT NULL,
    "lastCheckedAt" DATETIME,
    "lastCheckStatus" TEXT NOT NULL DEFAULT 'NEVER',
    "lastCheckError" TEXT,
    "lastPriceCheckAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Product_userId_normalizedUrl_key" ON "Product"("userId", "normalizedUrl");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_userId_url_key" ON "Product"("userId", "url");
CREATE INDEX IF NOT EXISTS "Product_userId_idx" ON "Product"("userId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "Product_storeId_idx" ON "Product"("storeId");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product"("status");
CREATE INDEX IF NOT EXISTS "Product_autoTrack_lastCheckedAt_idx" ON "Product"("autoTrack", "lastCheckedAt");

CREATE TABLE IF NOT EXISTS "ProductTag" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    PRIMARY KEY ("productId", "tagId"),
    CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProductTag_tagId_idx" ON "ProductTag"("tagId");

CREATE TABLE IF NOT EXISTS "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "autoTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priceUpdateIntervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "defaultProductView" TEXT NOT NULL DEFAULT 'grid',
    "lastBackupAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Settings_userId_key" ON "Settings"("userId");

CREATE TABLE IF NOT EXISTS "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Upload_filename_userId_key" ON "Upload" ("filename", "userId");
CREATE INDEX IF NOT EXISTS "Upload_userId_idx" ON "Upload" ("userId");

-- Dormant legacy price-tracking tables. The PHP app keeps the data readable
-- and included in backups but does not run background price checks.

CREATE TABLE IF NOT EXISTS "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "originalPrice" REAL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "availability" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PriceHistory_productId_recordedAt_idx" ON "PriceHistory"("productId", "recordedAt");

CREATE TABLE IF NOT EXISTS "PriceCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "errorMessage" TEXT,
    CONSTRAINT "PriceCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PriceCheck_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PriceCheck_productId_startedAt_idx" ON "PriceCheck"("productId", "startedAt");
CREATE INDEX IF NOT EXISTS "PriceCheck_status_idx" ON "PriceCheck"("status");

CREATE TABLE IF NOT EXISTS "PriceOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sellerName" TEXT,
    "imageUrl" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "ean" TEXT,
    "condition" TEXT,
    "latestTotalPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "matchStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" DATETIME,
    "rejectedAt" DATETIME,
    CONSTRAINT "PriceOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PriceOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PriceOffer_userId_provider_externalId_key" ON "PriceOffer" ("userId", "provider", "externalId");
CREATE INDEX IF NOT EXISTS "PriceOffer_productId_idx" ON "PriceOffer"("productId");
CREATE INDEX IF NOT EXISTS "PriceOffer_provider_idx" ON "PriceOffer"("provider");
CREATE INDEX IF NOT EXISTS "PriceOffer_matchStatus_idx" ON "PriceOffer"("matchStatus");
CREATE INDEX IF NOT EXISTS "PriceOffer_latestTotalPriceCents_idx" ON "PriceOffer"("latestTotalPriceCents");

CREATE TABLE IF NOT EXISTS "PriceProviderRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "finishedAt" DATETIME,
    CONSTRAINT "PriceProviderRun_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "PriceCheck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PriceProviderRun_checkId_idx" ON "PriceProviderRun"("checkId");
CREATE INDEX IF NOT EXISTS "PriceProviderRun_provider_idx" ON "PriceProviderRun"("provider");

CREATE TABLE IF NOT EXISTS "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "checkId" TEXT,
    "itemPriceCents" INTEGER,
    "shippingPriceCents" INTEGER,
    "totalPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "availability" TEXT,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PriceOffer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PriceSnapshot_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "PriceCheck" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PriceSnapshot_offerId_observedAt_idx" ON "PriceSnapshot"("offerId", "observedAt");
CREATE INDEX IF NOT EXISTS "PriceSnapshot_checkId_idx" ON "PriceSnapshot"("checkId");
