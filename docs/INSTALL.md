# Gift Vault PHP – Install on Mikrus

## Requirements
- Alpine Linux 3.23
- PHP 8.2+ (php84 recommended), extensions: pdo, pdo_sqlite, sqlite3, mbstring, openssl, curl, zip, gd or imagick, session, json, fileinfo, ffi (optional for legacy scrypt)
- Nginx
- PHP-FPM

## Steps
1. Upload project to /var/www/gift-vault (exclude data/ from git; create manually).
2. Create data directories: mkdir -p data/{backups,uploads,rate-limits,logs}
3. Copy .env.example to .env and set OWNER_SETUP_KEY.
4. Run migrations: php bin/migrate.php
5. (Optional) Migrate old Node DB: php bin/migrate-from-node.php data/gift-vault.db
6. Set permissions: chown -R www-data:www-data data
7. Configure Nginx + PHP-FPM from deploy/.
8. Open /setup to create owner account (or use existing migrated owner).

## Backup
- php bin/backup.php
- Restore via Settings UI or unzip manually with safety backup.

## PHP extensions
pdo pdo_sqlite sqlite3 mbstring openssl curl zip gd fileinfo session json ffi (optional)