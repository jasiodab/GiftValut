<?php
require dirname(__DIR__) . '/app/bootstrap.php';
$username = $argv[1] ?? '';
$email = $argv[2] ?? '';
$password = $argv[3] ?? '';
if ($username === '' || $email === '' || $password === '') {
    fwrite(STDERR, "Usage: php bin/create-owner.php <username> <email> <password>\n");
    exit(1);
}
$users = new App\Repositories\UserRepository();
if ($users->ownerCount() > 0) { fwrite(STDERR, "Owner already exists.\n"); exit(1); }
$user = $users->create($username, $email, App\Core\Auth::hashPassword($password), 'OWNER');
App\Services\AccountDefaults::ensure((string)$user['id']);
echo "Owner created: $username\n";