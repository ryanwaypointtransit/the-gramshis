import { NextResponse } from "next/server";
import { getDb, Market, Outcome } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";

export const dynamic = "force-dynamic";

interface MarketWithOutcomes extends Market {
  outcomes: (Outcome & { price: number })[];
}

export async function GET() {
  try {
    const db = getDb();

    const markets = db
      .prepare(
        `SELECT * FROM markets WHERE status != 'draft' ORDER BY
         CASE status
           WHEN 'open' THEN 1
           WHEN 'paused' THEN 2
           WHEN 'resolved' THEN 3
         END,
         created_at DESC`
      )
      .all() as Market[];

    const marketsWithOutcomes: MarketWithOutcomes[] = markets.map((market) => {
      const outcomes = db
        .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
        .all(market.id) as Outcome[];

      const shares = outcomes.map((o) => o.shares_outstanding);
      const prices = calculatePrices(shares, market.liquidity_param);

      const outcomesWithPrices = outcomes.map((o, i) => ({
        ...o,
        price: prices[i],
      }));

      return {
        ...market,
        outcomes: outcomesWithPrices,
      };
    });

    return NextResponse.json({ markets: marketsWithOutcomes });
  } catch (error) {
    console.error("Markets fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
