<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\Auth;
use App\Core\Flash;
use App\Core\HttpException;
use App\Core\Response;
use App\Core\Str;
use App\Core\Validator;
use App\Core\View;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimitMiddleware;
use App\Repositories\InvitationRepository;
use App\Repositories\SessionRepository;
use App\Repositories\UserRepository;
use App\Services\AccountDefaults;
use App\Services\Serializer;

final class AuthController extends Controller
{
    private UserRepository $users;
    private InvitationRepository $invitations;

    public function __construct(\App\Core\Request $request)
    {
        parent::__construct($request);
        $this->users = new UserRepository();
        $this->invitations = new InvitationRepository();
    }

    public function setupStatus(): Response
    {
        return Response::json(['needsSetup' => $this->users->ownerCount() === 0]);
    }

    public function bootstrap(): Response
    {
        RateLimitMiddleware::bootstrap($this->request);
        $validator = new Validator($this->jsonInput());
        $setupKey = $validator->requiredString('setupKey', 500, 'Setup key');
        $username = $validator->requiredString('username', 40, 'Username', 3);
        $email = $validator->email('email', 'Email');
        $password = $validator->requiredString('password', 500, 'Password', 12);
        $validator->throwIfFails();

        $expectedKey = (string) App::config('security.owner_setup_key');
        if ($expectedKey === '' || !hash_equals($expectedKey, $setupKey)) {
            throw new HttpException(403, 'Invalid setup key.', 'INVALID_SETUP_KEY');
        }
        if ($this->users->ownerCount() > 0) {
            throw new HttpException(409, 'Owner already exists.', 'OWNER_EXISTS');
        }
        $this->assertUniqueIdentity($username, (string) $email);

        $user = $this->users->create($username, (string) $email, Auth::hashPassword($password), 'OWNER');
        $this->users->claimUnownedData((string) $user['id']);
        AccountDefaults::ensure((string) $user['id']);
        Auth::login($this->request, $user);

        return Response::json(['user' => Serializer::user($user)], 201);
    }

    public function login(): Response
    {
        RateLimitMiddleware::login($this->request);
        $validator = new Validator($this->jsonInput());
        $login = $validator->requiredString('username', 190, 'Username or email');
        $password = $validator->requiredString('password', 500, 'Password');
        $validator->throwIfFails();

        $user = $this->users->findByLogin($login);
        if ($user === null || ($user['status'] ?? '') !== 'ACTIVE' || !Auth::verifyPassword($password, (string) $user['passwordHash'])) {
            throw new HttpException(401, 'Invalid credentials.', 'INVALID_CREDENTIALS');
        }

        if (Auth::isLegacyHash((string) $user['passwordHash'])) {
            Auth::rehashPassword((string) $user['id'], $password);
        }
        $this->users->touchLogin((string) $user['id']);
        AccountDefaults::ensure((string) $user['id']);
        Auth::login($this->request, $user);

        return Response::json(['user' => Serializer::user($user)]);
    }

    public function logout(): Response
    {
        Auth::logout($this->request);
        return Response::json(['ok' => true]);
    }

    public function me(): Response
    {
        $user = Auth::user();
        if ($user === null) {
            return Response::error(401, 'UNAUTHORIZED', 'Not authenticated.');
        }
        return Response::json(['user' => Serializer::user($user, true)]);
    }

    public function changePassword(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $validator = new Validator($this->jsonInput());
        $current = $validator->requiredString('currentPassword', 500, 'Current password');
        $new = $validator->requiredString('newPassword', 500, 'New password', 12);
        $validator->throwIfFails();

        $row = $this->users->findById((string) $user['id']);
        if ($row === null || !Auth::verifyPassword($current, (string) $row['passwordHash'])) {
            throw new HttpException(401, 'Current password is incorrect.', 'INVALID_PASSWORD');
        }

        $this->users->updatePassword((string) $user['id'], Auth::hashPassword($new));
        Auth::revokeAllSessions((string) $user['id']);
        return Response::json(['ok' => true]);
    }

    public function createInvitation(): Response
    {
        $user = AuthMiddleware::owner($this->request);
        $input = $this->jsonInput();
        $hours = 48;
        if (isset($input['expiresInHours'])) {
            if (!is_numeric($input['expiresInHours'])) {
                throw new HttpException(400, 'Please check the highlighted fields.', 'VALIDATION_ERROR', [
                    'fieldErrors' => ['expiresInHours' => ['Enter a valid number of hours.']],
                ]);
            }
            $hours = (int) $input['expiresInHours'];
            if ($hours < 1 || $hours > 720) {
                throw new HttpException(400, 'Please check the highlighted fields.', 'VALIDATION_ERROR', [
                    'fieldErrors' => ['expiresInHours' => ['Expiration must be between 1 and 720 hours.']],
                ]);
            }
        }

        $token = Str::token(32);
        $expiresAt = Str::nowMs() + ($hours * 3600000);
        $invitation = $this->invitations->create(Str::hashToken($token), (string) $user['id'], $expiresAt);

        return Response::json([
            'invitation' => [
                'id' => (string) $invitation['id'],
                'expiresAt' => Str::isoFromMs($expiresAt),
                'link' => '/invite/' . $token,
            ],
        ], 201);
    }

    public function listInvitations(): Response
    {
        AuthMiddleware::owner($this->request);
        return Response::json([
            'invitations' => array_map([Serializer::class, 'invitation'], $this->invitations->listRecent()),
        ]);
    }

    public function revokeInvitation(string $id): Response
    {
        AuthMiddleware::owner($this->request);
        if (!$this->invitations->revoke($id)) {
            throw new HttpException(404, 'Invitation not found.', 'INVITATION_NOT_FOUND');
        }
        return Response::json(['ok' => true]);
    }

    public function acceptInvitation(): Response
    {
        $validator = new Validator($this->jsonInput());
        $token = $validator->requiredString('token', 500, 'Invitation token');
        $username = $validator->requiredString('username', 40, 'Username', 3);
        $email = $validator->email('email', 'Email');
        $password = $validator->requiredString('password', 500, 'Password', 12);
        $validator->throwIfFails();

        $user = App::db()->transaction(function () use ($token, $username, $email, $password): array {
            $invitation = $this->invitations->findByTokenHash(Str::hashToken($token));
            if ($invitation === null
                || $invitation['revokedAt'] !== null
                || $invitation['usedAt'] !== null
                || (int) $invitation['expiresAt'] < Str::nowMs()) {
                throw new HttpException(400, 'Invalid or expired invitation.', 'INVALID_INVITATION');
            }
            $this->assertUniqueIdentity($username, (string) $email);
            $created = $this->users->create($username, (string) $email, Auth::hashPassword($password), 'USER');
            if (!$this->invitations->consume((string) $invitation['id'], (string) $created['id'])) {
                throw new HttpException(400, 'Invalid or expired invitation.', 'INVALID_INVITATION');
            }
            return $created;
        });

        AccountDefaults::ensure((string) $user['id']);
        Auth::login($this->request, $user);
        return Response::json(['user' => Serializer::user($user)], 201);
    }

    public function listUsers(): Response
    {
        AuthMiddleware::owner($this->request);
        $users = array_map(static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'username' => (string) $row['username'],
                'email' => (string) $row['email'],
                'role' => (string) $row['role'],
                'status' => (string) $row['status'],
                'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
                'lastLoginAt' => $row['lastLoginAt'] !== null ? Str::isoFromMs($row['lastLoginAt']) : null,
            ];
        }, $this->users->listAll());
        return Response::json(['users' => $users]);
    }

    public function blockUser(string $id): Response
    {
        $owner = AuthMiddleware::owner($this->request);
        if ($id === (string) $owner['id']) {
            throw new HttpException(400, 'Cannot block yourself.', 'INVALID');
        }
        if (!$this->users->setStatus($id, 'DISABLED')) {
            throw new HttpException(404, 'User not found.', 'USER_NOT_FOUND');
        }
        (new SessionRepository())->revokeAllForUser($id);
        return Response::json(['ok' => true]);
    }

    public function unblockUser(string $id): Response
    {
        AuthMiddleware::owner($this->request);
        if (!$this->users->setStatus($id, 'ACTIVE')) {
            throw new HttpException(404, 'User not found.', 'USER_NOT_FOUND');
        }
        return Response::json(['ok' => true]);
    }

    public function deleteUser(string $id): Response
    {
        $owner = AuthMiddleware::owner($this->request);
        if ($id === (string) $owner['id']) {
            throw new HttpException(400, 'Cannot delete yourself.', 'INVALID');
        }
        if (!$this->users->delete($id)) {
            throw new HttpException(404, 'User not found.', 'USER_NOT_FOUND');
        }
        return Response::json(['ok' => true]);
    }

    // ---- Server-rendered forms -------------------------------------------------

    public function showLogin(): Response
    {
        if (Auth::user() !== null) {
            return Response::redirect(url('/'));
        }
        $next = (string) $this->request->query('next', '');
        return View::render('auth/login', [
            'title' => 'Sign in · Gift Vault',
            'next' => $this->safeNext($next),
            'needsSetup' => $this->users->ownerCount() === 0,
            'layout' => 'auth-layout',
        ], 'auth-layout');
    }

    public function loginForm(): Response
    {
        RateLimitMiddleware::login($this->request);
        \App\Middleware\CsrfMiddleware::enforce($this->request);

        $login = trim((string) $this->request->input('username', ''));
        $password = (string) $this->request->input('password', '');
        $next = $this->safeNext((string) $this->request->input('next', ''));

        $user = $this->users->findByLogin($login);
        if ($user === null || ($user['status'] ?? '') !== 'ACTIVE' || !Auth::verifyPassword($password, (string) $user['passwordHash'])) {
            Flash::error('Invalid credentials.');
            return Response::redirect(url('login' . ($next !== '' ? '?next=' . rawurlencode($next) : '')));
        }

        if (Auth::isLegacyHash((string) $user['passwordHash'])) {
            Auth::rehashPassword((string) $user['id'], $password);
        }
        $this->users->touchLogin((string) $user['id']);
        AccountDefaults::ensure((string) $user['id']);
        Auth::login($this->request, $user);

        return Response::redirect(url($next !== '' ? $next : '/'));
    }

    public function logoutForm(): Response
    {
        \App\Middleware\CsrfMiddleware::enforce($this->request);
        Auth::logout($this->request);
        Flash::success('You have been signed out.');
        return Response::redirect(url('login'));
    }

    public function showSetup(): Response
    {
        if ($this->users->ownerCount() > 0) {
            return Response::redirect(url('login'));
        }
        return View::render('auth/setup', [
            'title' => 'Create your vault · Gift Vault',
            'layout' => 'auth-layout',
        ], 'auth-layout');
    }

    public function setupForm(): Response
    {
        RateLimitMiddleware::bootstrap($this->request);
        \App\Middleware\CsrfMiddleware::enforce($this->request);

        $setupKey = (string) $this->request->input('setupKey', '');
        $username = trim((string) $this->request->input('username', ''));
        $email = trim((string) $this->request->input('email', ''));
        $password = (string) $this->request->input('password', '');

        $expectedKey = (string) App::config('security.owner_setup_key');
        if ($expectedKey === '' || !hash_equals($expectedKey, $setupKey)) {
            Flash::error('Invalid setup key. Check OWNER_SETUP_KEY in your .env file.');
            return Response::redirect(url('setup'));
        }
        if ($this->users->ownerCount() > 0) {
            return Response::redirect(url('login'));
        }
        if (mb_strlen($username) < 3 || mb_strlen($username) > 40) {
            Flash::error('Username must be between 3 and 40 characters.');
            return Response::redirect(url('setup'));
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Flash::error('Enter a valid email address.');
            return Response::redirect(url('setup'));
        }
        if (mb_strlen($password) < 12) {
            Flash::error('Password must be at least 12 characters.');
            return Response::redirect(url('setup'));
        }
        if ($this->users->findByUsername($username) !== null || $this->users->findByEmail($email) !== null) {
            Flash::error('That username or email is already in use.');
            return Response::redirect(url('setup'));
        }

        $user = $this->users->create($username, $email, Auth::hashPassword($password), 'OWNER');
        $this->users->claimUnownedData((string) $user['id']);
        AccountDefaults::ensure((string) $user['id']);
        Auth::login($this->request, $user);
        Flash::success('Welcome to Gift Vault. Your vault is ready.');
        return Response::redirect(url('/'));
    }

    public function showInvite(string $token): Response
    {
        if (Auth::user() !== null) {
            return Response::redirect(url('/'));
        }
        $invitation = $this->invitations->findByTokenHash(Str::hashToken($token));
        $valid = $invitation !== null
            && $invitation['revokedAt'] === null
            && $invitation['usedAt'] === null
            && (int) $invitation['expiresAt'] >= Str::nowMs();
        return View::render('auth/invite', [
            'title' => 'Accept invitation · Gift Vault',
            'layout' => 'auth-layout',
            'token' => $token,
            'valid' => $valid,
        ], 'auth-layout');
    }

    public function inviteForm(): Response
    {
        \App\Middleware\CsrfMiddleware::enforce($this->request);
        $token = (string) $this->request->input('token', '');
        $username = trim((string) $this->request->input('username', ''));
        $email = trim((string) $this->request->input('email', ''));
        $password = (string) $this->request->input('password', '');

        $invitation = $this->invitations->findByTokenHash(Str::hashToken($token));
        if ($invitation === null
            || $invitation['revokedAt'] !== null
            || $invitation['usedAt'] !== null
            || (int) $invitation['expiresAt'] < Str::nowMs()) {
            Flash::error('Invalid or expired invitation.');
            return Response::redirect(url('invite/' . rawurlencode($token)));
        }
        if (mb_strlen($username) < 3 || mb_strlen($username) > 40) {
            Flash::error('Username must be between 3 and 40 characters.');
            return Response::redirect(url('invite/' . rawurlencode($token)));
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Flash::error('Enter a valid email address.');
            return Response::redirect(url('invite/' . rawurlencode($token)));
        }
        if (mb_strlen($password) < 12) {
            Flash::error('Password must be at least 12 characters.');
            return Response::redirect(url('invite/' . rawurlencode($token)));
        }
        if ($this->users->findByUsername($username) !== null || $this->users->findByEmail($email) !== null) {
            Flash::error('That username or email is already in use.');
            return Response::redirect(url('invite/' . rawurlencode($token)));
        }

        $user = App::db()->transaction(function () use ($invitation, $username, $email, $password): array {
            $created = $this->users->create($username, $email, Auth::hashPassword($password), 'USER');
            if (!$this->invitations->consume((string) $invitation['id'], (string) $created['id'])) {
                throw new HttpException(400, 'Invalid or expired invitation.', 'INVALID_INVITATION');
            }
            return $created;
        });

        AccountDefaults::ensure((string) $user['id']);
        Auth::login($this->request, $user);
        Flash::success('Your account is ready. Welcome to Gift Vault.');
        return Response::redirect(url('/'));
    }

    public function changePasswordForm(): Response
    {
        $user = AuthMiddleware::user($this->request);
        \App\Middleware\CsrfMiddleware::enforce($this->request);

        $current = (string) $this->request->input('currentPassword', '');
        $new = (string) $this->request->input('newPassword', '');
        $row = $this->users->findById((string) $user['id']);

        if ($row === null || !Auth::verifyPassword($current, (string) $row['passwordHash'])) {
            Flash::error('Current password is incorrect.');
            return Response::redirect(url('settings#account'));
        }
        if (mb_strlen($new) < 12) {
            Flash::error('New password must be at least 12 characters.');
            return Response::redirect(url('settings#account'));
        }

        $this->users->updatePassword((string) $user['id'], Auth::hashPassword($new));
        Auth::revokeAllSessions((string) $user['id']);
        Flash::success('Password updated. Please sign in again.');
        return Response::redirect(url('login'));
    }

    private function assertUniqueIdentity(string $username, string $email): void
    {
        if ($this->users->findByUsername($username) !== null) {
            throw new HttpException(409, 'That username is already in use.', 'CONFLICT');
        }
        if ($this->users->findByEmail($email) !== null) {
            throw new HttpException(409, 'That email address is already in use.', 'CONFLICT');
        }
    }

    private function safeNext(string $next): string
    {
        if ($next === '' || !str_starts_with($next, '/') || str_starts_with($next, '//') || str_contains($next, '\\')) {
            return '';
        }
        return $next;
    }
}
