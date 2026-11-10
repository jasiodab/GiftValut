-- Gift Vault schema, version 2.
-- Category Groups: shared categories with members and invitations.

CREATE TABLE IF NOT EXISTS "CategoryGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#D9A3B0',
    "icon" TEXT NOT NULL DEFAULT 'Users',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CategoryGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryGroup_ownerId_name_key" ON "CategoryGroup" ("ownerId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryGroup_ownerId_slug_key" ON "CategoryGroup" ("ownerId", "slug");

CREATE TABLE IF NOT EXISTS "CategoryGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedById" TEXT,
    CONSTRAINT "CategoryGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CategoryGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryGroupMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryGroupMember_groupId_userId_key" ON "CategoryGroupMember" ("groupId", "userId");
CREATE INDEX IF NOT EXISTS "CategoryGroupMember_userId_idx" ON "CategoryGroupMember" ("userId");

CREATE TABLE IF NOT EXISTS "CategoryGroupInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "invitedById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedById" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryGroupInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CategoryGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryGroupInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryGroupInvitation_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryGroupInvitation_tokenHash_key" ON "CategoryGroupInvitation" ("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryGroupInvitation_groupId_email_key" ON "CategoryGroupInvitation" ("groupId", "email");
CREATE INDEX IF NOT EXISTS "CategoryGroupInvitation_groupId_idx" ON "CategoryGroupInvitation" ("groupId");
CREATE INDEX IF NOT EXISTS "CategoryGroupInvitation_email_idx" ON "CategoryGroupInvitation" ("email");

-- Products can belong to a shared group (in addition to their category).
ALTER TABLE "Product" ADD COLUMN "groupId" TEXT;
CREATE INDEX IF NOT EXISTS "Product_groupId_idx" ON "Product" ("groupId");
CREATE INDEX IF NOT EXISTS "Product_groupId_userId_idx" ON "Product" ("groupId", "userId");

-- Foreign key for Product.groupId (SQLite cannot ADD CONSTRAINT on existing table easily,
-- so we rely on application-level integrity; the column is nullable).
