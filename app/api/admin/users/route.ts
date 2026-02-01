import { NextRequest, NextResponse } from "next/server";
import { getDb, User } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const db = getDb();

    const users = db
      .prepare("SELECT * FROM users ORDER BY created_at DESC")
      .all() as User[];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
