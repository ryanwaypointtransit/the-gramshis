import { NextResponse } from "next/server";
import { getDb, Market, Outcome, User, Position } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";

export const dynamic = "force-dynamic";

interface LeaderboardEntry {
  rank: number;
  id: number;
  name: string;
  displayName: string;
  balance: number;
  positionValue: number;
  totalValue: number;
  positionCount: number;
}

export async function GET() {
  try {
    const db = getDb();

    const users = db.prepare("SELECT * FROM users").all() as User[];

    const leaderboard: LeaderboardEntry[] = users.map((user) => {
      // Calculate position values
      const positions = db
        .prepare(
          `SELECT p.*, o.market_id
           FROM positions p
           JOIN outcomes o ON p.outcome_id = o.id
           WHERE p.user_id = ? AND p.shares > 0`
        )
        .all(user.id) as (Position & { market_id: number })[];

      let positionValue = 0;
      let positionCount = 0;

      for (const pos of positions) {
        const market = db.prepare("SELECT * FROM markets WHERE id = ?").get(pos.market_id) as Market;
        if (market.status !== "open" && market.status !== "paused") continue;

        const outcomes = db
          .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
          .all(market.id) as Outcome[];

        const sharesArray = outcomes.map((o) => o.shares_outstanding);
        const prices = calculatePrices(sharesArray, market.liquidity_param);

        const outcomeIndex = outcomes.findIndex((o) => o.id === pos.outcome_id);
        if (outcomeIndex !== -1) {
          positionValue += pos.shares * prices[outcomeIndex];
          positionCount++;
        }
      }

      return {
        rank: 0,
        id: user.id,
        name: user.name,
        displayName: user.display_name,
        balance: user.balance,
        positionValue,
        totalValue: user.balance + positionValue,
        positionCount,
      };
    });

    // Sort by total value
    leaderboard.sort((a, b) => b.totalValue - a.totalValue);

    // Add ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
