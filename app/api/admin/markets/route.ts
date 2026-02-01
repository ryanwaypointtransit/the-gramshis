import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await sql`SELECT * FROM markets ORDER BY created_at DESC`;

    return NextResponse.json({ markets: result });
  } catch (error) {
    console.error("Admin markets error:", error);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { name, description, outcomes, liquidityParam = 100 } = await request.json();

    if (!name || !outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
      return NextResponse.json(
        { error: "Market name and at least 2 outcomes are required" },
        { status: 400 }
      );
    }

    // Create market
    const marketResult = await sql`
      INSERT INTO markets (name, description, liquidity_param, status) 
      VALUES (${name}, ${description || null}, ${liquidityParam}, 'draft')
      RETURNING id
    `;
    const marketId = (marketResult[0] as { id: number }).id;

    // Create outcomes
    for (let i = 0; i < outcomes.length; i++) {
      await sql`
        INSERT INTO outcomes (market_id, name, display_order) 
        VALUES (${marketId}, ${outcomes[i]}, ${i})
      `;
    }

    // Log admin action (system/anonymous)
    await sql`
      INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) 
      VALUES (${0}, ${'create_market'}, ${'market'}, ${marketId}, ${JSON.stringify({ name, outcomes })})
    `;

    return NextResponse.json({ success: true, marketId });
  } catch (error) {
    console.error("Create market error:", error);
    return NextResponse.json({ error: "Failed to create market" }, { status: 500 });
  }
}
