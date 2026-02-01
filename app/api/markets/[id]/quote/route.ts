import { NextRequest, NextResponse } from "next/server";
import { sql, Market, Outcome } from "@/lib/db";
import { calculateTradeCost, calculatePrices, averagePricePerShare } from "@/lib/market-maker/lmsr";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = parseInt(id, 10);
    const { searchParams } = new URL(request.url);
    const outcomeId = parseInt(searchParams.get("outcomeId") || "", 10);
    const shares = parseFloat(searchParams.get("shares") || "0");
    const action = searchParams.get("action") || "buy";

    if (isNaN(marketId) || isNaN(outcomeId) || isNaN(shares) || shares <= 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const marketResult = await sql`SELECT * FROM markets WHERE id = ${marketId}`;
    const market = marketResult[0] as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status !== "open") {
      return NextResponse.json({ error: "Market is not open for trading" }, { status: 400 });
    }

    const outcomesResult = await sql`
      SELECT * FROM outcomes WHERE market_id = ${marketId} ORDER BY display_order
    `;
    const outcomes = outcomesResult as Outcome[];

    const outcomeIndex = outcomes.findIndex((o) => o.id === outcomeId);
    if (outcomeIndex === -1) {
      return NextResponse.json({ error: "Outcome not found" }, { status: 404 });
    }

    const currentShares = outcomes.map((o) => Number(o.shares_outstanding));
    const sharesToTrade = action === "sell" ? -shares : shares;
    const liquidityParam = Number(market.liquidity_param);

    const cost = calculateTradeCost(currentShares, outcomeIndex, sharesToTrade, liquidityParam);
    const avgPrice = averagePricePerShare(currentShares, outcomeIndex, sharesToTrade, liquidityParam);

    // Calculate new prices after trade
    const newShares = [...currentShares];
    newShares[outcomeIndex] += sharesToTrade;
    const newPrices = calculatePrices(newShares, liquidityParam);
    const currentPrices = calculatePrices(currentShares, liquidityParam);

    return NextResponse.json({
      quote: {
        outcomeId,
        outcomeName: outcomes[outcomeIndex].name,
        action,
        shares,
        totalCost: Math.abs(cost),
        avgPricePerShare: avgPrice,
        currentPrice: currentPrices[outcomeIndex],
        newPrice: newPrices[outcomeIndex],
        priceImpact: newPrices[outcomeIndex] - currentPrices[outcomeIndex],
      },
    });
  } catch (error) {
    console.error("Quote error:", error);
    return NextResponse.json({ error: "Failed to get quote" }, { status: 500 });
  }
}
