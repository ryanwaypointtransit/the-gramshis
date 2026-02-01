import { NextRequest, NextResponse } from "next/server";
import { createSession, getOrCreateUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    const user = await getOrCreateUser(trimmedName, trimmedName);
    const token = await createSession(user);

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        displayName: user.display_name,
        balance: Number(user.balance),
        isAdmin: user.is_admin === 1,
      },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
