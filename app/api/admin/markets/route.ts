import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const db = getDb();

    const markets = db
      .prepare("SELECT * FROM markets ORDER BY created_at DESC")
      .all();

    return NextResponse.json({ markets });
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

    const db = getDb();

    const createMarket = db.transaction(() => {
      // Create market
      const marketResult = db
        .prepare(
          "INSERT INTO markets (name, description, liquidity_param, status) VALUES (?, ?, ?, 'draft')"
        )
        .run(name, description || null, liquidityParam);

      const marketId = marketResult.lastInsertRowid;

      // Create outcomes
      for (let i = 0; i < outcomes.length; i++) {
        db.prepare(
          "INSERT INTO outcomes (market_id, name, display_order) VALUES (?, ?, ?)"
        ).run(marketId, outcomes[i], i);
      }

      // Log admin action (system/anonymous)
      db.prepare(
        "INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)"
      ).run(0, "create_market", "market", marketId, JSON.stringify({ name, outcomes }));

      return marketId;
    });

    const marketId = createMarket();

    return NextResponse.json({ success: true, marketId });
  } catch (error) {
    console.error("Create market error:", error);
    return NextResponse.json({ error: "Failed to create market" }, { status: 500 });
  }
}
