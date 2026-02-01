import { NextRequest, NextResponse } from "next/server";
import { getDb, Market, Outcome, Position } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface OutcomeWithPrice extends Outcome {
  price: number;
  userShares: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = parseInt(id, 10);

    if (isNaN(marketId)) {
      return NextResponse.json({ error: "Invalid market ID" }, { status: 400 });
    }

    const db = getDb();
    const session = await getSession();

    const market = db
      .prepare("SELECT * FROM markets WHERE id = ?")
      .get(marketId) as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const outcomes = db
      .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
      .all(marketId) as Outcome[];

    const shares = outcomes.map((o) => o.shares_outstanding);
    const prices = calculatePrices(shares, market.liquidity_param);

    // Get user positions if logged in
    let userPositions: Record<number, number> = {};
    if (session) {
      const positions = db
        .prepare(
          `SELECT outcome_id, shares FROM positions
           WHERE user_id = ? AND outcome_id IN (${outcomes.map(() => "?").join(",")})`
        )
        .all(session.userId, ...outcomes.map((o) => o.id)) as Position[];

      userPositions = positions.reduce((acc, p) => {
        acc[p.outcome_id] = p.shares;
        return acc;
      }, {} as Record<number, number>);
    }

    const outcomesWithPrices: OutcomeWithPrice[] = outcomes.map((o, i) => ({
      ...o,
      price: prices[i],
      userShares: userPositions[o.id] || 0,
    }));

    return NextResponse.json({
      market: {
        ...market,
        outcomes: outcomesWithPrices,
      },
    });
  } catch (error) {
    console.error("Market fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch market" }, { status: 500 });
  }
}
