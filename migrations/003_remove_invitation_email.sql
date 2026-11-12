-- Gift Vault schema, version 3.
-- Zaproszenia do grupy nie sa juz przypisane do konkretnego adresu e-mail.
-- Zaproszenie to jednorazowy link, ktory kazda osoba moze otworzyc i
-- decyzja czy dolaczyc do grupy, czy nie, nalezy do tej osoby.

DROP INDEX IF EXISTS "CategoryGroupInvitation_groupId_email_key";
DROP INDEX IF EXISTS "CategoryGroupInvitation_email_idx";

-- SQLite obsluguje DROP COLUMN dopiero od wersji 3.35.0, wiec odtwarzamy
-- tabelę bez kolumny email, aby migracja byla kompatybilna rowniez ze starszymi SQLite.
CREATE TABLE IF NOT EXISTS "CategoryGroupInvitation_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "invitedById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedById" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryGroupInvitation_new_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CategoryGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryGroupInvitation_new_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryGroupInvitation_new_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "CategoryGroupInvitation_new" (id, groupId, tokenHash, role, invitedById, expiresAt, usedAt, usedById, revokedAt, createdAt)
SELECT id, groupId, tokenHash, role, invitedById, expiresAt, usedAt, usedById, revokedAt, createdAt FROM "CategoryGroupInvitation";

DROP TABLE IF EXISTS "CategoryGroupInvitation";

ALTER TABLE "CategoryGroupInvitation_new" RENAME TO "CategoryGroupInvitation";

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryGroupInvitation_tokenHash_key" ON "CategoryGroupInvitation" ("tokenHash");
CREATE INDEX IF NOT EXISTS "CategoryGroupInvitation_groupId_idx" ON "CategoryGroupInvitation" ("groupId");
