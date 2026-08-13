import bcrypt from "bcrypt";
import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminUsers, type AdminUser } from "../db/schema.js";
import { env } from "../env.js";

const JWT_ALGORITHM = "HS256";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createAccessToken(userId: string): string {
  const expire = new Date(Date.now() + env.JWT_EXPIRE_HOURS * 60 * 60 * 1000);
  return jwt.sign({ sub: userId, exp: Math.floor(expire.getTime() / 1000) }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
  });
}

function readBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw authError("Not authenticated");
  }
  return header.slice("Bearer ".length);
}

export function getAuthUserId(request: FastifyRequest): string {
  const token = readBearerToken(request);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as {
      sub?: string;
    };
    if (!payload.sub) throw authError("Invalid token");
    return payload.sub;
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) throw error;
    throw authError("Invalid token");
  }
}

export async function getCurrentUser(request: FastifyRequest): Promise<AdminUser> {
  const userId = getAuthUserId(request);
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId)).limit(1);
  if (!user) throw authError("User not found");
  return user;
}

function authError(detail: string) {
  const err = new Error(detail) as Error & { statusCode: number };
  err.statusCode = 401;
  return err;
}

export function sendAuthError(reply: FastifyReply, error: unknown): void {
  const statusCode =
    error instanceof Error && "statusCode" in error
      ? (error as Error & { statusCode: number }).statusCode
      : 500;
  const detail = error instanceof Error ? error.message : "Internal error";
  reply.status(statusCode).send({ detail });
}

export function userOut(user: AdminUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
