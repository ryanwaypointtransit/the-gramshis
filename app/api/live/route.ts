import { NextResponse } from "next/server";
import { getDb, Market, Outcome, User, Position } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";

export const dynamic = "force-dynamic";

interface LeaderboardEntry {
  id: number;
  name: string;
  displayName: string;
  balance: number;
  positionValue: number;
  totalValue: number;
}

export async function GET() {
  try {
    const db = getDb();

    // Get all open markets with their outcomes and prices
    const markets = db
      .prepare("SELECT * FROM markets WHERE status = 'open' ORDER BY created_at DESC")
      .all() as Market[];

    const marketsWithPrices = markets.map((market) => {
      const outcomes = db
        .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
        .all(market.id) as Outcome[];

      const shares = outcomes.map((o) => o.shares_outstanding);
      const prices = calculatePrices(shares, market.liquidity_param);

      return {
        id: market.id,
        name: market.name,
        outcomes: outcomes.map((o, i) => ({
          id: o.id,
          name: o.name,
          price: prices[i],
        })),
      };
    });

    // Get leaderboard (top 10 by total portfolio value)
    const users = db.prepare("SELECT * FROM users ORDER BY balance DESC").all() as User[];

    const leaderboard: LeaderboardEntry[] = users.map((user) => {
      // Calculate position values
      const positions = db
        .prepare(
          `SELECT p.*, o.market_id, o.shares_outstanding
           FROM positions p
           JOIN outcomes o ON p.outcome_id = o.id
           WHERE p.user_id = ? AND p.shares > 0`
        )
        .all(user.id) as (Position & { market_id: number; shares_outstanding: number })[];

      let positionValue = 0;
      for (const pos of positions) {
        const market = db.prepare("SELECT * FROM markets WHERE id = ?").get(pos.market_id) as Market;
        if (market.status !== "open") continue;

        const outcomes = db
          .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
          .all(market.id) as Outcome[];

        const sharesArray = outcomes.map((o) => o.shares_outstanding);
        const prices = calculatePrices(sharesArray, market.liquidity_param);

        const outcomeIndex = outcomes.findIndex((o) => o.id === pos.outcome_id);
        if (outcomeIndex !== -1) {
          positionValue += pos.shares * prices[outcomeIndex];
        }
      }

      return {
        id: user.id,
        name: user.name,
        displayName: user.display_name,
        balance: user.balance,
        positionValue,
        totalValue: user.balance + positionValue,
      };
    });

    // Sort by total value and take top 10
    leaderboard.sort((a, b) => b.totalValue - a.totalValue);
    const topLeaderboard = leaderboard.slice(0, 10);

    return NextResponse.json({
      markets: marketsWithPrices,
      leaderboard: topLeaderboard,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Live data error:", error);
    return NextResponse.json({ error: "Failed to fetch live data" }, { status: 500 });
  }
}
