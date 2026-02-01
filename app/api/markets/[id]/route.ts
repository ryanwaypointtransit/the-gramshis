import { NextRequest, NextResponse } from "next/server";
import { sql, Market, Outcome, Position } from "@/lib/db";
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

    const session = await getSession();

    const marketResult = await sql`SELECT * FROM markets WHERE id = ${marketId}`;
    const market = marketResult.rows[0] as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const outcomesResult = await sql`
      SELECT * FROM outcomes WHERE market_id = ${marketId} ORDER BY display_order
    `;
    const outcomes = outcomesResult.rows as Outcome[];

    const shares = outcomes.map((o) => Number(o.shares_outstanding));
    const prices = calculatePrices(shares, Number(market.liquidity_param));

    // Get user positions if logged in
    let userPositions: Record<number, number> = {};
    if (session) {
      const positionsResult = await sql`
        SELECT outcome_id, shares FROM positions
        WHERE user_id = ${session.userId} 
        AND outcome_id IN (SELECT id FROM outcomes WHERE market_id = ${marketId})
      `;
      const positions = positionsResult.rows as Position[];

      userPositions = positions.reduce((acc, p) => {
        acc[p.outcome_id] = Number(p.shares);
        return acc;
      }, {} as Record<number, number>);
    }

    const outcomesWithPrices: OutcomeWithPrice[] = outcomes.map((o, i) => ({
      ...o,
      shares_outstanding: Number(o.shares_outstanding),
      price: prices[i],
      userShares: userPositions[o.id] || 0,
    }));

    return NextResponse.json({
      market: {
        ...market,
        liquidity_param: Number(market.liquidity_param),
        outcomes: outcomesWithPrices,
      },
    });
  } catch (error) {
    console.error("Market fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch market" }, { status: 500 });
  }
}
