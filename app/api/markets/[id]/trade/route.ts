import { NextRequest, NextResponse } from "next/server";
import { sql, Market, Outcome, Position, User } from "@/lib/db";
import { calculateTradeCost, calculatePrices, validateTrade } from "@/lib/market-maker/lmsr";
import { requireAuth } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const marketId = parseInt(id, 10);
    const { outcomeId, shares, action } = await request.json();

    if (isNaN(marketId) || !outcomeId || !shares || shares <= 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    if (action !== "buy" && action !== "sell") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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

    // Get fresh user balance
    const freshUserResult = await sql`SELECT * FROM users WHERE id = ${user.id}`;
    const freshUser = freshUserResult[0] as User;

    // Get user's current position
    const positionResult = await sql`
      SELECT * FROM positions WHERE user_id = ${user.id} AND outcome_id = ${outcomeId}
    `;
    const position = positionResult[0] as Position | undefined;

    const userShares = position ? Number(position.shares) : 0;
    const currentShares = outcomes.map((o) => Number(o.shares_outstanding));
    const sharesToTrade = action === "sell" ? -shares : shares;
    const liquidityParam = Number(market.liquidity_param);

    // Validate trade
    const validationError = validateTrade(
      currentShares,
      outcomeIndex,
      sharesToTrade,
      Number(freshUser.balance),
      userShares,
      liquidityParam
    );

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Calculate cost
    const cost = calculateTradeCost(currentShares, outcomeIndex, sharesToTrade, liquidityParam);
    const avgPrice = Math.abs(cost / sharesToTrade);

    // Execute trade
    const newBalance = Number(freshUser.balance) - cost;
    
    // Update user balance
    await sql`UPDATE users SET balance = ${newBalance} WHERE id = ${user.id}`;

    // Update or create position
    const newSharesCount = userShares + sharesToTrade;
    if (position) {
      if (newSharesCount > 0.0001) {
        // Update average cost basis for buys
        let newAvgCost = Number(position.avg_cost_basis);
        if (action === "buy") {
          const totalCost = Number(position.avg_cost_basis) * userShares + cost;
          newAvgCost = totalCost / newSharesCount;
        }
        await sql`UPDATE positions SET shares = ${newSharesCount}, avg_cost_basis = ${newAvgCost} WHERE id = ${position.id}`;
      } else {
        // Delete position if shares are 0
        await sql`DELETE FROM positions WHERE id = ${position.id}`;
      }
    } else if (sharesToTrade > 0) {
      await sql`
        INSERT INTO positions (user_id, outcome_id, shares, avg_cost_basis) 
        VALUES (${user.id}, ${outcomeId}, ${sharesToTrade}, ${avgPrice})
      `;
    }

    // Update outcome shares outstanding
    await sql`
      UPDATE outcomes SET shares_outstanding = shares_outstanding + ${sharesToTrade} WHERE id = ${outcomeId}
    `;

    // Log transaction
    await sql`
      INSERT INTO transactions (user_id, outcome_id, type, shares, price_per_share, total_cost, balance_before, balance_after)
      VALUES (${user.id}, ${outcomeId}, ${action}, ${shares}, ${avgPrice}, ${Math.abs(cost)}, ${freshUser.balance}, ${newBalance})
    `;

    // Get updated prices
    const updatedOutcomesResult = await sql`
      SELECT * FROM outcomes WHERE market_id = ${marketId} ORDER BY display_order
    `;
    const updatedOutcomes = updatedOutcomesResult as Outcome[];
    const newSharesArray = updatedOutcomes.map((o) => Number(o.shares_outstanding));
    const newPrices = calculatePrices(newSharesArray, liquidityParam);

    return NextResponse.json({
      success: true,
      trade: {
        action,
        shares,
        totalCost: Math.abs(cost),
        avgPrice,
        newBalance,
      },
      newPrices: updatedOutcomes.map((o, i) => ({
        outcomeId: o.id,
        price: newPrices[i],
      })),
    });
  } catch (error) {
    console.error("Trade error:", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Trade failed" }, { status: 500 });
  }
}
