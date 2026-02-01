import { NextRequest, NextResponse } from "next/server";
import { sql, Market, Outcome } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";
import { sharesForTargetPrices, calculatePrices } from "@/lib/market-maker/lmsr";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { id } = await params;
    const marketId = parseInt(id, 10);
    const { odds } = await request.json();

    // odds should be an array of { outcomeId: number, price: number }
    if (!odds || !Array.isArray(odds)) {
      return NextResponse.json({ error: "Odds array is required" }, { status: 400 });
    }

    const marketResult = await sql`SELECT * FROM markets WHERE id = ${marketId}`;
    const market = marketResult[0] as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status !== "draft") {
      return NextResponse.json(
        { error: "Can only set initial odds on draft markets" },
        { status: 400 }
      );
    }

    const outcomesResult = await sql`
      SELECT * FROM outcomes WHERE market_id = ${marketId} ORDER BY display_order
    `;
    const outcomes = outcomesResult as Outcome[];

    if (odds.length !== outcomes.length) {
      return NextResponse.json(
        { error: "Must provide odds for all outcomes" },
        { status: 400 }
      );
    }

    // Validate and extract prices in order
    const prices: number[] = [];
    for (const outcome of outcomes) {
      const odd = odds.find((o: { outcomeId: number; price: number }) => o.outcomeId === outcome.id);
      if (!odd || typeof odd.price !== "number" || odd.price <= 0) {
        return NextResponse.json(
          { error: `Invalid or missing price for outcome ${outcome.name}` },
          { status: 400 }
        );
      }
      prices.push(odd.price);
    }

    // Calculate required shares for these prices
    const shares = sharesForTargetPrices(prices, Number(market.liquidity_param));

    // Update outcomes with new shares
    for (let i = 0; i < outcomes.length; i++) {
      await sql`UPDATE outcomes SET shares_outstanding = ${shares[i]} WHERE id = ${outcomes[i].id}`;
    }

    // Log admin action (system/anonymous)
    await sql`
      INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) 
      VALUES (${0}, ${'set_odds'}, ${'market'}, ${marketId}, ${JSON.stringify({ odds, shares })})
    `;

    // Return the actual resulting prices (may differ slightly due to normalization)
    const resultingPrices = calculatePrices(shares, Number(market.liquidity_param));

    return NextResponse.json({
      success: true,
      outcomes: outcomes.map((o, i) => ({
        id: o.id,
        name: o.name,
        shares: shares[i],
        price: resultingPrices[i],
      })),
    });
  } catch (error) {
    console.error("Set odds error:", error);
    return NextResponse.json({ error: "Failed to set odds" }, { status: 500 });
  }
}
