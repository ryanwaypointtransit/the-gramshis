import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sql, User } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "gramshis-secret-key-change-in-production"
);

const ADMIN_NAMES = (process.env.ADMIN_NAMES || "admin").split(",").map((n) => n.trim().toLowerCase());

// Secret URL segment for admin access - change this in production!
const ADMIN_SECRET = process.env.ADMIN_SECRET || "gramshis-control-2026";

export function getAdminSecret(): string {
  return ADMIN_SECRET;
}

export function verifyAdminSecret(secret: string): boolean {
  return secret === ADMIN_SECRET;
}

export function verifyAdminHeader(request: Request): boolean {
  const adminKey = request.headers.get("x-admin-key");
  return adminKey === ADMIN_SECRET;
}

export interface SessionPayload {
  userId: number;
  name: string;
  isAdmin: boolean;
}

export async function createSession(user: User): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    name: user.name,
    isAdmin: user.is_admin === 1,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  return verifySession(token);
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const result = await sql`SELECT * FROM users WHERE id = ${session.userId}`;
  return (result.rows[0] as User) || null;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (!user.is_admin) {
    throw new Error("Not authorized");
  }
  return user;
}

export function isAdminName(name: string): boolean {
  return ADMIN_NAMES.includes(name.toLowerCase());
}

export async function getOrCreateUser(name: string, displayName?: string): Promise<User> {
  const normalizedName = name.toLowerCase().trim();
  const display = displayName || name;

  // Try to find existing user
  const existingResult = await sql`SELECT * FROM users WHERE name = ${normalizedName}`;
  let user = existingResult.rows[0] as User | undefined;

  if (!user) {
    // Create new user
    const isAdmin = isAdminName(normalizedName) ? 1 : 0;
    const insertResult = await sql`
      INSERT INTO users (name, display_name, is_admin) 
      VALUES (${normalizedName}, ${display}, ${isAdmin})
      RETURNING *
    `;
    user = insertResult.rows[0] as User;
  }

  return user;
}
