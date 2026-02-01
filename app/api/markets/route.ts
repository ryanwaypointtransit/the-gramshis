import { NextResponse } from "next/server";
import { sql, Market, Outcome } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";

export const dynamic = "force-dynamic";

interface MarketWithOutcomes extends Market {
  outcomes: (Outcome & { price: number })[];
}

export async function GET() {
  try {
    const marketsResult = await sql`
      SELECT * FROM markets WHERE status != 'draft' ORDER BY
      CASE status
        WHEN 'open' THEN 1
        WHEN 'paused' THEN 2
        WHEN 'resolved' THEN 3
      END,
      created_at DESC
    `;
    const markets = marketsResult as Market[];

    const marketsWithOutcomes: MarketWithOutcomes[] = [];
    
    for (const market of markets) {
      const outcomesResult = await sql`
        SELECT * FROM outcomes WHERE market_id = ${market.id} ORDER BY display_order
      `;
      const outcomes = outcomesResult as Outcome[];

      const shares = outcomes.map((o) => Number(o.shares_outstanding));
      const prices = calculatePrices(shares, Number(market.liquidity_param));

      const outcomesWithPrices = outcomes.map((o, i) => ({
        ...o,
        shares_outstanding: Number(o.shares_outstanding),
        price: prices[i],
      }));

      marketsWithOutcomes.push({
        ...market,
        liquidity_param: Number(market.liquidity_param),
        outcomes: outcomesWithPrices,
      });
    }

    return NextResponse.json({ markets: marketsWithOutcomes });
  } catch (error) {
    console.error("Markets fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
