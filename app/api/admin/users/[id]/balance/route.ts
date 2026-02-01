import { NextRequest, NextResponse } from "next/server";
import { sql, User } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { id } = await params;
    const userId = parseInt(id, 10);
    const { amount, reason } = await request.json();

    if (typeof amount !== "number") {
      return NextResponse.json({ error: "Amount is required" }, { status: 400 });
    }

    const userResult = await sql`SELECT * FROM users WHERE id = ${userId}`;
    const user = userResult.rows[0] as User | undefined;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newBalance = Number(user.balance) + amount;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: "Cannot reduce balance below 0" },
        { status: 400 }
      );
    }

    await sql`UPDATE users SET balance = ${newBalance} WHERE id = ${userId}`;

    // Log admin action (system/anonymous)
    await sql`
      INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) 
      VALUES (${0}, ${'adjust_balance'}, ${'user'}, ${userId}, ${JSON.stringify({ amount, reason, oldBalance: user.balance, newBalance })})
    `;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        oldBalance: Number(user.balance),
        newBalance,
      },
    });
  } catch (error) {
    console.error("Adjust balance error:", error);
    return NextResponse.json({ error: "Failed to adjust balance" }, { status: 500 });
  }
}
