#!/usr/bin/env python3
"""One-time SQLite schema upgrade for account-scoped Gift Vault data."""
import os
import sqlite3
import sys

database_url = os.environ.get("DATABASE_URL", "")
if not database_url.startswith("file:"):
    raise SystemExit("DATABASE_URL must use a SQLite file: URL.")
database_path = database_url[5:].split("?", 1)[0]
if not database_path:
    raise SystemExit("DATABASE_URL does not contain a database path.")

db = sqlite3.connect(database_path)
try:
    db.execute("PRAGMA foreign_keys = OFF")
    db.execute("BEGIN IMMEDIATE")

    for index in (
        "Product_url_key", "Product_normalizedUrl_key", "Category_name_key",
        "Category_slug_key", "Store_domain_key", "Tag_name_key",
        "PriceOffer_provider_externalId_key",
    ):
        db.execute(f'DROP INDEX IF EXISTS "{index}"')

    settings_sql = db.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='Settings'"
    ).fetchone()
    if settings_sql and "AUTOINCREMENT" not in (settings_sql[0] or "").upper():
        db.execute('''
            CREATE TABLE "Settings_new" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "userId" TEXT UNIQUE,
              "currency" TEXT NOT NULL DEFAULT 'PLN',
              "autoTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
              "priceUpdateIntervalMinutes" INTEGER NOT NULL DEFAULT 360,
              "defaultProductView" TEXT NOT NULL DEFAULT 'grid',
              "budget" REAL,
              "lastBackupAt" DATETIME,
              "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" DATETIME NOT NULL,
              FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
            )
        ''')
        db.execute('''
            INSERT INTO "Settings_new"
            SELECT "id", "userId", "currency", "autoTrackingEnabled",
                   "priceUpdateIntervalMinutes", "defaultProductView", "budget",
                   "lastBackupAt", "createdAt", "updatedAt"
            FROM "Settings"
        ''')
        db.execute('DROP TABLE "Settings"')
        db.execute('ALTER TABLE "Settings_new" RENAME TO "Settings"')
        db.execute('CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings" ("userId")')

    db.execute('''
        CREATE TABLE IF NOT EXISTS "Upload" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "filename" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    ''')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Upload_filename_userId_key" ON "Upload" ("filename", "userId")')
    db.execute('CREATE INDEX IF NOT EXISTS "Upload_userId_idx" ON "Upload" ("userId")')

    # Backfill ownership for images that predate the Upload table so existing
    # product images remain readable after the migration. Older databases without
    # a Product.userId column are handled later by migrate-tenancy.
    try:
        owner_row = db.execute(
            'SELECT "id" FROM "User" WHERE "role" = \'OWNER\' ORDER BY "createdAt" LIMIT 1'
        ).fetchone()
        owner_id = owner_row[0] if owner_row else None
        for image_path, user_id in db.execute(
            'SELECT DISTINCT "imagePath", "userId" FROM "Product" WHERE "imagePath" IS NOT NULL'
        ):
            filename = os.path.basename(image_path)
            effective_user = user_id or owner_id
            if not filename or not effective_user:
                continue
            db.execute(
                'INSERT OR IGNORE INTO "Upload" ("id", "filename", "userId") '
                "VALUES (lower(hex(randomblob(12))), ?, ?)",
                (filename, effective_user),
            )
    except sqlite3.OperationalError:
        pass

    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Product_userId_url_key" ON "Product" ("userId", "url")')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Product_userId_normalizedUrl_key" ON "Product" ("userId", "normalizedUrl")')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_name_key" ON "Category" ("userId", "name")')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_slug_key" ON "Category" ("userId", "slug")')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Store_userId_domain_key" ON "Store" ("userId", "domain")')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Tag_userId_name_key" ON "Tag" ("userId", "name")')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "PriceOffer_userId_provider_externalId_key" ON "PriceOffer" ("userId", "provider", "externalId")')

    db.commit()
    print("SQLite schema migration complete.")
finally:
    db.close()
