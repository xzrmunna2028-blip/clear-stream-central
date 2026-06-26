// Server-only admin session helpers (cookie via iron-session under the hood).
import { useSession } from "@tanstack/react-start/server";

export type AdminSession = { isAdmin?: boolean; loginAt?: number };

export function getSessionConfig() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET missing or too short");
  }
  return {
    password,
    name: "fsh_admin",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getAdminSession() {
  return await useSession<AdminSession>(getSessionConfig());
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.data.isAdmin) {
    throw new Error("Unauthorized");
  }
  return session;
}
