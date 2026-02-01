import { NextRequest, NextResponse } from "next/server";
import { sql, Market, Outcome, Position, User } from "@/lib/db";
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

    const marketResult = await sql`SELECT * FROM markets WHERE id = ${marketId}`;
    const market = marketResult[0] as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status !== "open" && market.status !== "paused") {
      return NextResponse.json(
        { error: "Can only resolve open or paused markets" },
        { status: 400 }
      );
    }

    const winningOutcomeResult = await sql`
      SELECT * FROM outcomes WHERE id = ${winningOutcomeId} AND market_id = ${marketId}
    `;
    const winningOutcome = winningOutcomeResult[0] as Outcome | undefined;

    if (!winningOutcome) {
      return NextResponse.json({ error: "Winning outcome not found in this market" }, { status: 404 });
    }

    // Get all outcomes in this market
    const outcomesResult = await sql`SELECT * FROM outcomes WHERE market_id = ${marketId}`;
    const outcomes = outcomesResult as Outcome[];

    // Get all positions for these outcomes (using a subquery)
    const positionsResult = await sql`
      SELECT * FROM positions 
      WHERE outcome_id IN (SELECT id FROM outcomes WHERE market_id = ${marketId}) 
      AND shares > 0
    `;
    const positions = positionsResult as Position[];

    const payouts: { userId: number; amount: number; shares: number }[] = [];

    // Process payouts
    for (const position of positions) {
      if (position.outcome_id === winningOutcomeId) {
        // Winner! Pay $1 per share
        const payout = Number(position.shares);
        const userResult = await sql`SELECT * FROM users WHERE id = ${position.user_id}`;
        const user = userResult[0] as User;

        await sql`UPDATE users SET balance = balance + ${payout} WHERE id = ${position.user_id}`;

        payouts.push({
          userId: position.user_id,
          amount: payout,
          shares: Number(position.shares),
        });

        // Log payout transaction
        const balanceAfter = Number(user.balance) + payout;
        await sql`
          INSERT INTO transactions (user_id, outcome_id, type, shares, price_per_share, total_cost, balance_before, balance_after)
          VALUES (${position.user_id}, ${position.outcome_id}, 'payout', ${position.shares}, ${1.00}, ${payout}, ${user.balance}, ${balanceAfter})
        `;
      }
      // Losing positions get nothing, positions remain for record keeping
    }

    // Update market status
    await sql`
      UPDATE markets SET status = 'resolved', winning_outcome_id = ${winningOutcomeId}, resolved_at = NOW() 
      WHERE id = ${marketId}
    `;

    // Log admin action (system/anonymous)
    await sql`
      INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) 
      VALUES (${0}, ${'resolve_market'}, ${'market'}, ${marketId}, ${JSON.stringify({ winningOutcomeId, winningOutcomeName: winningOutcome.name, payouts })})
    `;

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
