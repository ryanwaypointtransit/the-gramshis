import { NextRequest, NextResponse } from "next/server";
import { getDb, Market, Outcome, Position, User } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { marketId: marketIdStr } = await params;
    const marketId = parseInt(marketIdStr, 10);
    const { winningOutcomeId } = await request.json();

    if (!winningOutcomeId) {
      return NextResponse.json({ error: "Winning outcome ID is required" }, { status: 400 });
    }

    const db = getDb();

    const market = db.prepare("SELECT * FROM markets WHERE id = ?").get(marketId) as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status !== "open" && market.status !== "paused") {
      return NextResponse.json(
        { error: "Can only resolve open or paused markets" },
        { status: 400 }
      );
    }

    const winningOutcome = db
      .prepare("SELECT * FROM outcomes WHERE id = ? AND market_id = ?")
      .get(winningOutcomeId, marketId) as Outcome | undefined;

    if (!winningOutcome) {
      return NextResponse.json({ error: "Winning outcome not found in this market" }, { status: 404 });
    }

    // Get all positions in this market
    const outcomes = db
      .prepare("SELECT * FROM outcomes WHERE market_id = ?")
      .all(marketId) as Outcome[];

    const outcomeIds = outcomes.map((o) => o.id);

    const positions = db
      .prepare(
        `SELECT * FROM positions WHERE outcome_id IN (${outcomeIds.map(() => "?").join(",")}) AND shares > 0`
      )
      .all(...outcomeIds) as Position[];

    // Resolve market and pay out in transaction
    const resolveMarket = db.transaction(() => {
      const payouts: { userId: number; amount: number; shares: number }[] = [];

      for (const position of positions) {
        if (position.outcome_id === winningOutcomeId) {
          // Winner! Pay $1 per share
          const payout = position.shares;
          const user = db.prepare("SELECT * FROM users WHERE id = ?").get(position.user_id) as User;

          db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(payout, position.user_id);

          payouts.push({
            userId: position.user_id,
            amount: payout,
            shares: position.shares,
          });

          // Log payout transaction
          db.prepare(
            `INSERT INTO transactions (user_id, outcome_id, type, shares, price_per_share, total_cost, balance_before, balance_after)
             VALUES (?, ?, 'payout', ?, 1.00, ?, ?, ?)`
          ).run(
            position.user_id,
            position.outcome_id,
            position.shares,
            payout,
            user.balance,
            user.balance + payout
          );
        }
        // Losing positions get nothing, positions remain for record keeping
      }

      // Update market status
      db.prepare(
        "UPDATE markets SET status = 'resolved', winning_outcome_id = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(winningOutcomeId, marketId);

      // Log admin action (system/anonymous)
      db.prepare(
        "INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)"
      ).run(
        0,
        "resolve_market",
        "market",
        marketId,
        JSON.stringify({ winningOutcomeId, winningOutcomeName: winningOutcome.name, payouts })
      );

      return payouts;
    });

    const payouts = resolveMarket();

    return NextResponse.json({
      success: true,
      winningOutcome: {
        id: winningOutcome.id,
        name: winningOutcome.name,
      },
      totalPayouts: payouts.reduce((sum, p) => sum + p.amount, 0),
      payoutCount: payouts.length,
    });
  } catch (error) {
    console.error("Resolve market error:", error);
    return NextResponse.json({ error: "Failed to resolve market" }, { status: 500 });
  }
}
