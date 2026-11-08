<?php
require dirname(__DIR__) . '/app/bootstrap.php';
$username = $argv[1] ?? '';
$password = $argv[2] ?? '';
if ($username === '' || $password === '') {
    fwrite(STDERR, "Usage: php bin/reset-password.php <username> <new-password>\n");
    exit(1);
}
$users = new App\Repositories\UserRepository();
$row = $users->findByUsername($username);
if ($row === null) { fwrite(STDERR, "User not found.\n"); exit(1); }
$users->updatePassword((string)$row['id'], App\Core\Auth::hashPassword($password));
echo "Password updated for $username\n";