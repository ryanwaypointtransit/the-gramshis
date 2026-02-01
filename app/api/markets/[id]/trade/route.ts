import { NextRequest, NextResponse } from "next/server";
import { getDb, Market, Outcome, Position, User } from "@/lib/db";
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

    const db = getDb();

    // Start transaction
    const market = db
      .prepare("SELECT * FROM markets WHERE id = ?")
      .get(marketId) as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status !== "open") {
      return NextResponse.json({ error: "Market is not open for trading" }, { status: 400 });
    }

    const outcomes = db
      .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
      .all(marketId) as Outcome[];

    const outcomeIndex = outcomes.findIndex((o) => o.id === outcomeId);
    if (outcomeIndex === -1) {
      return NextResponse.json({ error: "Outcome not found" }, { status: 404 });
    }

    // Get fresh user balance
    const freshUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as User;

    // Get user's current position
    const position = db
      .prepare("SELECT * FROM positions WHERE user_id = ? AND outcome_id = ?")
      .get(user.id, outcomeId) as Position | undefined;

    const userShares = position?.shares || 0;
    const currentShares = outcomes.map((o) => o.shares_outstanding);
    const sharesToTrade = action === "sell" ? -shares : shares;

    // Validate trade
    const validationError = validateTrade(
      currentShares,
      outcomeIndex,
      sharesToTrade,
      freshUser.balance,
      userShares,
      market.liquidity_param
    );

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Calculate cost
    const cost = calculateTradeCost(currentShares, outcomeIndex, sharesToTrade, market.liquidity_param);
    const avgPrice = Math.abs(cost / sharesToTrade);

    // Execute trade in transaction
    const executeTrade = db.transaction(() => {
      // Update user balance
      const newBalance = freshUser.balance - cost;
      db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, user.id);

      // Update or create position
      const newShares = userShares + sharesToTrade;
      if (position) {
        if (newShares > 0.0001) {
          // Update average cost basis for buys
          let newAvgCost = position.avg_cost_basis;
          if (action === "buy") {
            const totalCost = position.avg_cost_basis * userShares + cost;
            newAvgCost = totalCost / newShares;
          }
          db.prepare("UPDATE positions SET shares = ?, avg_cost_basis = ? WHERE id = ?").run(
            newShares,
            newAvgCost,
            position.id
          );
        } else {
          // Delete position if shares are 0
          db.prepare("DELETE FROM positions WHERE id = ?").run(position.id);
        }
      } else if (sharesToTrade > 0) {
        db.prepare(
          "INSERT INTO positions (user_id, outcome_id, shares, avg_cost_basis) VALUES (?, ?, ?, ?)"
        ).run(user.id, outcomeId, sharesToTrade, avgPrice);
      }

      // Update outcome shares outstanding
      db.prepare("UPDATE outcomes SET shares_outstanding = shares_outstanding + ? WHERE id = ?").run(
        sharesToTrade,
        outcomeId
      );

      // Log transaction
      db.prepare(
        `INSERT INTO transactions (user_id, outcome_id, type, shares, price_per_share, total_cost, balance_before, balance_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, outcomeId, action, shares, avgPrice, Math.abs(cost), freshUser.balance, newBalance);

      return newBalance;
    });

    const newBalance = executeTrade();

    // Get updated prices
    const updatedOutcomes = db
      .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
      .all(marketId) as Outcome[];
    const newSharesArray = updatedOutcomes.map((o) => o.shares_outstanding);
    const newPrices = calculatePrices(newSharesArray, market.liquidity_param);

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
