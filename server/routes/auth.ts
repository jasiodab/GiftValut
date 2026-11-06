import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, AppError } from "../lib/errors";
import { hashPassword, verifyPassword, createSession, revokeSession, revokeAllSessions, generateToken, hashToken } from "../lib/auth";
import { requireAuth, requireOwner } from "../middleware/auth";
import { ensureAccountDefaults } from "../services/accountDefaults";

export const authRouter = Router();

const isProd = process.env.NODE_ENV === "production";

function setSessionCookie(res: any, token: string) {
  const parts = [`gv_session=${encodeURIComponent(token)}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${60*60*24*7}`];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: any) {
  res.setHeader("Set-Cookie", "gv_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

// Bootstrap owner (one-time)
authRouter.post("/bootstrap", asyncHandler(async (req, res) => {
  const schema = z.object({
    setupKey: z.string().min(1),
    username: z.string().min(3).max(40),
    email: z.string().email(),
    password: z.string().min(12)
  });
  const body = schema.parse(req.body);
  if (!process.env.OWNER_SETUP_KEY || body.setupKey !== process.env.OWNER_SETUP_KEY) {
    throw new AppError(403, "Invalid setup key.", "INVALID_SETUP_KEY");
  }
  const existingOwner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (existingOwner) throw new AppError(409, "Owner already exists.", "OWNER_EXISTS");
  const user = await prisma.user.create({
    data: {
      username: body.username,
      email: body.email,
      passwordHash: hashPassword(body.password),
      role: "OWNER",
      status: "ACTIVE"
    }
  });
  // assign existing unowned data to owner
  await prisma.product.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.category.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.tag.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.productGroup.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.priceHistory.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.priceOffer.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.priceCheck.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.settings.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.store.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await ensureAccountDefaults(user.id);
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
  const body = schema.parse(req.body);
  const user = await prisma.user.findFirst({ where: { OR: [{ username: body.username }, { email: body.username }] } });
  if (!user || user.status !== "ACTIVE" || !verifyPassword(body.password, user.passwordHash)) {
    throw new AppError(401, "Invalid credentials.", "INVALID_CREDENTIALS");
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
}));

authRouter.post("/logout", asyncHandler(async (req, res) => {
  const token = (() => {
    const c = req.headers.cookie || "";
    const m = c.match(/(?:^|;\s*)gv_session=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  })();
  await revokeSession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

authRouter.get("/me", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } });
  res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role, status: user.status } });
}));

authRouter.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12) });
  const body = schema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: (req as any).user.id } });
  if (!user || !verifyPassword(body.currentPassword, user.passwordHash)) {
    throw new AppError(401, "Current password is incorrect.", "INVALID_PASSWORD");
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(body.newPassword) } });
  await revokeAllSessions(user.id);
  res.json({ ok: true });
}));

// Invitations (owner only)
authRouter.post("/invitations", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const schema = z.object({ expiresInHours: z.number().min(1).max(720).default(48) });
  const body = schema.parse(req.body ?? {});
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000);
  const inv = await prisma.invitation.create({
    data: { tokenHash, createdById: (req as any).user.id, expiresAt }
  });
  res.status(201).json({ invitation: { id: inv.id, expiresAt, link: `/invite/${token}` } });
}));

authRouter.get("/invitations", requireAuth, requireOwner, asyncHandler(async (_req, res) => {
  const list = await prisma.invitation.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  res.json({ invitations: list.map((i) => ({ id: i.id, expiresAt: i.expiresAt, usedAt: i.usedAt, revokedAt: i.revokedAt, createdAt: i.createdAt })) });
}));

authRouter.post("/invitations/:id/revoke", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const result = await prisma.invitation.updateMany({
    where: { id, revokedAt: null, usedAt: null },
    data: { revokedAt: new Date() }
  });
  if (result.count === 0) throw new AppError(404, "Invitation not found.", "INVITATION_NOT_FOUND");
  res.json({ ok: true });
}));

// Accept invitation
authRouter.post("/invite/accept", asyncHandler(async (req, res) => {
  const schema = z.object({ token: z.string().min(1), username: z.string().min(3).max(40), email: z.string().email(), password: z.string().min(12) });
  const body = schema.parse(req.body);
  const tokenHash = hashToken(body.token);
  // Create the account and consume the invitation atomically so a token can
  // never be redeemed twice by concurrent requests.
  const user = await prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUnique({ where: { tokenHash } });
    if (!inv || inv.revokedAt || inv.usedAt || inv.expiresAt < new Date()) {
      throw new AppError(400, "Invalid or expired invitation.", "INVALID_INVITATION");
    }
    const created = await tx.user.create({
      data: { username: body.username, email: body.email, passwordHash: hashPassword(body.password), role: "USER", status: "ACTIVE" }
    });
    const consumed = await tx.invitation.updateMany({
      where: { id: inv.id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date(), usedById: created.id }
    });
    if (consumed.count === 0) {
      throw new AppError(400, "Invalid or expired invitation.", "INVALID_INVITATION");
    }
    return created;
  });
  await ensureAccountDefaults(user.id);
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
}));

// Users management (owner)
authRouter.get("/users", requireAuth, requireOwner, asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, username: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true } });
  res.json({ users });
}));

authRouter.post("/users/:id/block", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const result = await prisma.user.updateMany({ where: { id }, data: { status: "DISABLED" } });
  if (result.count === 0) throw new AppError(404, "User not found.", "USER_NOT_FOUND");
  await revokeAllSessions(id);
  res.json({ ok: true });
}));

authRouter.post("/users/:id/unblock", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const result = await prisma.user.updateMany({ where: { id }, data: { status: "ACTIVE" } });
  if (result.count === 0) throw new AppError(404, "User not found.", "USER_NOT_FOUND");
  res.json({ ok: true });
}));

authRouter.delete("/users/:id", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const owner = (req as any).user;
  if (id === owner.id) throw new AppError(400, "Cannot delete yourself.", "INVALID");
  const result = await prisma.user.deleteMany({ where: { id } });
  if (result.count === 0) throw new AppError(404, "User not found.", "USER_NOT_FOUND");
  res.json({ ok: true });
}));
