import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  createAccessToken,
  getCurrentUser,
  hashPassword,
  sendAuthError,
  userOut,
  verifyPassword,
} from "../auth/jwt.js";
import { db } from "../db/client.js";
import { adminUsers } from "../db/schema.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/admin/auth/login", async (request, reply) => {
    try {
      const body = request.body as { email?: string; password?: string };
      const email = body.email?.trim().toLowerCase();
      const password = body.password ?? "";
      if (!email || !password) {
        return reply.status(400).send({ detail: "Email and password are required" });
      }

      const [user] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email))
        .limit(1);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return reply.status(401).send({ detail: "Invalid credentials" });
      }

      return {
        access_token: createAccessToken(user.id),
        user: userOut(user),
      };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.get("/admin/auth/me", async (request, reply) => {
    try {
      const user = await getCurrentUser(request);
      return { user: userOut(user) };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });
}

export { hashPassword };
