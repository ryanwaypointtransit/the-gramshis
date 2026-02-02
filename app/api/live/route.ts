import { NextResponse } from "next/server";
import { sql, Market, Outcome, User, Position } from "@/lib/db";
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

interface OutcomeBettor {
  name: string;
  shares: number;
}

export async function GET() {
  try {
    // Get all open markets with their outcomes and prices
    const marketsResult = await sql`
      SELECT * FROM markets WHERE status = 'open' ORDER BY created_at DESC
    `;
    const markets = marketsResult as Market[];

    const marketsWithPrices = [];
    for (const market of markets) {
      const outcomesResult = await sql`
        SELECT * FROM outcomes WHERE market_id = ${market.id} ORDER BY display_order
      `;
      const outcomes = outcomesResult as Outcome[];

      const shares = outcomes.map((o) => Number(o.shares_outstanding));
      const prices = calculatePrices(shares, Number(market.liquidity_param));

      // Get positions for each outcome (who's betting on what)
      const outcomesWithBettors = [];
      for (let i = 0; i < outcomes.length; i++) {
        const o = outcomes[i];
        const positionsResult = await sql`
          SELECT u.display_name as name, p.shares 
          FROM positions p 
          JOIN users u ON p.user_id = u.id 
          WHERE p.outcome_id = ${o.id} AND p.shares > 0.01
          ORDER BY p.shares DESC
          LIMIT 5
        `;
        
        outcomesWithBettors.push({
          id: o.id,
          name: o.name,
          price: prices[i],
          shares: Number(o.shares_outstanding),
          bettors: positionsResult.map((p: any) => ({
            name: p.name,
            shares: Number(p.shares),
          })),
        });
      }

      // Calculate total shares in market
      const totalShares = shares.reduce((a, b) => a + b, 0);

      marketsWithPrices.push({
        id: market.id,
        name: market.name,
        totalShares,
        outcomes: outcomesWithBettors,
      });
    }

    // Get leaderboard (top 10 by total portfolio value)
    const usersResult = await sql`SELECT * FROM users ORDER BY balance DESC`;
    const users = usersResult as User[];

    const leaderboard: LeaderboardEntry[] = [];

    for (const user of users) {
      // Calculate position values
      const positionsResult = await sql`
        SELECT p.*, o.market_id, o.shares_outstanding
        FROM positions p
        JOIN outcomes o ON p.outcome_id = o.id
        WHERE p.user_id = ${user.id} AND p.shares > 0
      `;
      const positions = positionsResult as (Position & { market_id: number; shares_outstanding: number })[];

      let positionValue = 0;
      for (const pos of positions) {
        const marketResult = await sql`SELECT * FROM markets WHERE id = ${pos.market_id}`;
        const market = marketResult[0] as Market;
        if (market.status !== "open") continue;

        const outcomesResult = await sql`
          SELECT * FROM outcomes WHERE market_id = ${market.id} ORDER BY display_order
        `;
        const outcomes = outcomesResult as Outcome[];

        const sharesArray = outcomes.map((o) => Number(o.shares_outstanding));
        const prices = calculatePrices(sharesArray, Number(market.liquidity_param));

        const outcomeIndex = outcomes.findIndex((o) => o.id === pos.outcome_id);
        if (outcomeIndex !== -1) {
          positionValue += Number(pos.shares) * prices[outcomeIndex];
        }
      }

      leaderboard.push({
        id: user.id,
        name: user.name,
        displayName: user.display_name,
        balance: Number(user.balance),
        positionValue,
        totalValue: Number(user.balance) + positionValue,
      });
    }

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
