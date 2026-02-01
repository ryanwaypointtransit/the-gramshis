import { NextRequest, NextResponse } from "next/server";
import { getDb, Market, Outcome } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";
import { calculatePrices } from "@/lib/market-maker/lmsr";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { id } = await params;
    const marketId = parseInt(id, 10);

    const db = getDb();

    const market = db.prepare("SELECT * FROM markets WHERE id = ?").get(marketId) as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const outcomes = db
      .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
      .all(marketId) as Outcome[];

    const shares = outcomes.map((o) => o.shares_outstanding);
    const prices = calculatePrices(shares, market.liquidity_param);

    return NextResponse.json({
      market: {
        ...market,
        outcomes: outcomes.map((o, i) => ({
          ...o,
          price: prices[i],
        })),
      },
    });
  } catch (error) {
    console.error("Admin market fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch market" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { id } = await params;
    const marketId = parseInt(id, 10);
    const { status, name, description } = await request.json();

    const db = getDb();

    const market = db.prepare("SELECT * FROM markets WHERE id = ?").get(marketId) as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Validate status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        draft: ["open"],
        open: ["paused", "resolved"],
        paused: ["open", "resolved"],
        resolved: [],
      };

      if (!validTransitions[market.status]?.includes(status)) {
        return NextResponse.json(
          { error: `Cannot change status from ${market.status} to ${status}` },
          { status: 400 }
        );
      }
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (status) {
      updates.push("status = ?");
      values.push(status);
    }
    if (name) {
      updates.push("name = ?");
      values.push(name);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    values.push(marketId);
    db.prepare(`UPDATE markets SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    // Log admin action (system/anonymous)
    db.prepare(
      "INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)"
    ).run(0, "update_market", "market", marketId, JSON.stringify({ status, name, description }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update market error:", error);
    return NextResponse.json({ error: "Failed to update market" }, { status: 500 });
  }
}
