import { NextResponse } from "next/server";
import { sql, Market, Outcome, User, Position } from "@/lib/db";
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
    const usersResult = await sql`SELECT * FROM users`;
    const users = usersResult as User[];

    const leaderboard: LeaderboardEntry[] = [];

    for (const user of users) {
      // Calculate position values
      const positionsResult = await sql`
        SELECT p.*, o.market_id
        FROM positions p
        JOIN outcomes o ON p.outcome_id = o.id
        WHERE p.user_id = ${user.id} AND p.shares > 0
      `;
      const positions = positionsResult as (Position & { market_id: number })[];

      let positionValue = 0;
      let positionCount = 0;

      for (const pos of positions) {
        const marketResult = await sql`SELECT * FROM markets WHERE id = ${pos.market_id}`;
        const market = marketResult[0] as Market;

        if (market.status === "resolved") {
          // For resolved markets: winners get $1/share, losers get $0
          if (pos.outcome_id === market.winning_outcome_id) {
            positionValue += Number(pos.shares); // $1 per share
            positionCount++;
          }
          // Losers get $0
        } else if (market.status === "open" || market.status === "paused") {
          // For active markets, use LMSR pricing
          const outcomesResult = await sql`
            SELECT * FROM outcomes WHERE market_id = ${market.id} ORDER BY display_order
          `;
          const outcomes = outcomesResult as Outcome[];

          const sharesArray = outcomes.map((o) => Number(o.shares_outstanding));
          const prices = calculatePrices(sharesArray, Number(market.liquidity_param));

          const outcomeIndex = outcomes.findIndex((o) => o.id === pos.outcome_id);
          if (outcomeIndex !== -1) {
            positionValue += Number(pos.shares) * prices[outcomeIndex];
            positionCount++;
          }
        }
        // Draft markets are ignored
      }

      leaderboard.push({
        rank: 0,
        id: user.id,
        name: user.name,
        displayName: user.display_name,
        balance: Number(user.balance),
        positionValue,
        totalValue: Number(user.balance) + positionValue,
        positionCount,
      });
    }

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
