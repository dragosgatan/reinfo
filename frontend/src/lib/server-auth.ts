import { NextRequest } from "next/server";

type Role = "student" | "teacher" | "admin" | "superuser";

interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

const ROLE_RANK: Record<Role, number> = {
  student: 0,
  teacher: 1,
  admin: 2,
  superuser: 3,
};

/**
 * Verifies the session cookie against the backend. Returns the user or null.
 * Forward all cookies from the incoming request so the backend session is resolved.
 */
export async function getSessionUser(req: NextRequest): Promise<AuthUser | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

export function hasRole(user: AuthUser, minRole: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[minRole];
}
