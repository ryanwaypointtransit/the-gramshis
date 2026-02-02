import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Bot names (same as bots.txt)
const BOT_NAMES = [
  "khia_asylum",
  "connor_toups_burner",
  "michalskrrrrrreta",
  "saif_turkiye",
  "dronestrikeryan",
  "miguel_decafe_",
  "dogin5c",
  "xxxadam_hargusxxx",
  "catherine_oooooo",
  "hisomeritsjonathonplsreply2mytxts",
];

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("CRON_SECRET not set, allowing request in development");
    return process.env.NODE_ENV === "development";
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get open markets
    const marketsResult = await sql`
      SELECT m.*, 
        (SELECT json_agg(json_build_object('id', o.id, 'name', o.name, 'shares_outstanding', o.shares_outstanding, 'display_order', o.display_order) ORDER BY o.display_order)
         FROM outcomes o WHERE o.market_id = m.id) as outcomes
      FROM markets m 
      WHERE m.status = 'open'
    `;
    
    if (marketsResult.length === 0) {
      return NextResponse.json({ message: "No open markets", trades: 0 });
    }

    let tradesExecuted = 0;
    const tradeResults: any[] = [];

    // Each bot has a chance to trade
    for (const botName of BOT_NAMES) {
      // 30% chance each bot trades on this tick
      if (Math.random() > 0.3) continue;

      // Get or create bot user
      let userResult = await sql`SELECT * FROM users WHERE name = ${botName}`;
      if (userResult.length === 0) {
        await sql`INSERT INTO users (name, display_name, balance) VALUES (${botName}, ${botName}, 1000)`;
        userResult = await sql`SELECT * FROM users WHERE name = ${botName}`;
      }
      const user = userResult[0];

      // Skip if balance too low
      if (Number(user.balance) < 20) continue;

      // Pick a random market
      const market = marketsResult[Math.floor(Math.random() * marketsResult.length)];
      const outcomes = market.outcomes || [];
      if (outcomes.length === 0) continue;

      // Pick a random outcome (weighted towards lower-priced ones for more interesting dynamics)
      const outcomeIndex = Math.floor(Math.random() * outcomes.length);
      const outcome = outcomes[outcomeIndex];

      // Generate bet size (10-100, but not more than 30% of balance)
      const maxBet = Math.min(100, Number(user.balance) * 0.3);
      const betSize = Math.max(10, Math.floor(Math.random() * maxBet));

      // Calculate shares to buy based on current price
      const shares = outcomes.map((o: any) => Number(o.shares_outstanding));
      const totalExp = shares.reduce((sum: number, s: number) => sum + Math.exp(s / 100), 0);
      const currentPrice = Math.exp(Number(outcome.shares_outstanding) / 100) / totalExp;
      
      // Buy shares (rough estimate based on price)
      const sharesToBuy = Math.floor(betSize / Math.max(currentPrice, 0.1));
      if (sharesToBuy < 1) continue;

      // Execute trade via internal logic (simplified LMSR)
      const beforeCost = 100 * Math.log(totalExp);
      const newShares = [...shares];
      newShares[outcomeIndex] += sharesToBuy;
      const newTotalExp = newShares.reduce((sum: number, s: number) => sum + Math.exp(s / 100), 0);
      const afterCost = 100 * Math.log(newTotalExp);
      const cost = afterCost - beforeCost;

      if (cost > Number(user.balance)) continue;

      // Update database
      const newBalance = Number(user.balance) - cost;
      await sql`UPDATE users SET balance = ${newBalance} WHERE id = ${user.id}`;
      await sql`UPDATE outcomes SET shares_outstanding = shares_outstanding + ${sharesToBuy} WHERE id = ${outcome.id}`;

      // Update or create position
      const posResult = await sql`SELECT * FROM positions WHERE user_id = ${user.id} AND outcome_id = ${outcome.id}`;
      if (posResult.length > 0) {
        const pos = posResult[0];
        const newSharesCount = Number(pos.shares) + sharesToBuy;
        const newAvgCost = (Number(pos.avg_cost_basis) * Number(pos.shares) + cost) / newSharesCount;
        await sql`UPDATE positions SET shares = ${newSharesCount}, avg_cost_basis = ${newAvgCost} WHERE id = ${pos.id}`;
      } else {
        await sql`INSERT INTO positions (user_id, outcome_id, shares, avg_cost_basis) VALUES (${user.id}, ${outcome.id}, ${sharesToBuy}, ${cost / sharesToBuy})`;
      }

      // Log transaction
      await sql`
        INSERT INTO transactions (user_id, outcome_id, type, shares, price_per_share, total_cost, balance_before, balance_after)
        VALUES (${user.id}, ${outcome.id}, 'buy', ${sharesToBuy}, ${cost / sharesToBuy}, ${cost}, ${user.balance}, ${newBalance})
      `;

      tradesExecuted++;
      tradeResults.push({
        bot: botName,
        market: market.name,
        outcome: outcome.name,
        shares: sharesToBuy,
        cost: cost.toFixed(2),
      });
    }

    return NextResponse.json({
      success: true,
      trades: tradesExecuted,
      results: tradeResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron bot tick error:", error);
    return NextResponse.json({ error: "Failed to execute bot tick" }, { status: 500 });
  }
}
