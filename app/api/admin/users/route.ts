import { NextRequest, NextResponse } from "next/server";
import { sql, User } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await sql`SELECT * FROM users ORDER BY created_at DESC`;

    return NextResponse.json({ users: result as User[] });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
