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

    const liquidityParam = 100;

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

      // Get bot's current positions
      const positionsResult = await sql`
        SELECT p.*, o.market_id, o.name as outcome_name
        FROM positions p
        JOIN outcomes o ON p.outcome_id = o.id
        WHERE p.user_id = ${user.id} AND p.shares > 1
      `;

      // Decide: buy or sell? 30% chance to sell if they have positions
      const shouldSell = positionsResult.length > 0 && Math.random() < 0.3;

      if (shouldSell) {
        // SELL: Pick a random position to sell from
        const position = positionsResult[Math.floor(Math.random() * positionsResult.length)];
        const marketResult = await sql`
          SELECT m.*, 
            (SELECT json_agg(json_build_object('id', o.id, 'name', o.name, 'shares_outstanding', o.shares_outstanding, 'display_order', o.display_order) ORDER BY o.display_order)
             FROM outcomes o WHERE o.market_id = m.id) as outcomes
          FROM markets m 
          WHERE m.id = ${position.market_id} AND m.status = 'open'
        `;
        
        if (marketResult.length === 0) continue;
        const market = marketResult[0];
        const outcomes = market.outcomes || [];
        
        // Find the outcome index
        const outcomeIndex = outcomes.findIndex((o: any) => o.id === position.outcome_id);
        if (outcomeIndex === -1) continue;
        const outcome = outcomes[outcomeIndex];

        // Sell 20-80% of position
        const sellPercent = 0.2 + Math.random() * 0.6;
        const sharesToSell = Math.floor(Number(position.shares) * sellPercent);
        if (sharesToSell < 1) continue;

        // Calculate proceeds via LMSR (selling = negative shares)
        const shares = outcomes.map((o: any) => Number(o.shares_outstanding));
        const totalExp = shares.reduce((sum: number, s: number) => sum + Math.exp(s / liquidityParam), 0);
        const beforeCost = liquidityParam * Math.log(totalExp);
        
        const newShares = [...shares];
        newShares[outcomeIndex] -= sharesToSell;
        if (newShares[outcomeIndex] < 0) continue; // Can't go negative
        
        const newTotalExp = newShares.reduce((sum: number, s: number) => sum + Math.exp(s / liquidityParam), 0);
        const afterCost = liquidityParam * Math.log(newTotalExp);
        const proceeds = beforeCost - afterCost; // Selling gives money back

        // Update database
        const newBalance = Number(user.balance) + proceeds;
        await sql`UPDATE users SET balance = ${newBalance} WHERE id = ${user.id}`;
        await sql`UPDATE outcomes SET shares_outstanding = shares_outstanding - ${sharesToSell} WHERE id = ${outcome.id}`;

        // Update position
        const newSharesCount = Number(position.shares) - sharesToSell;
        if (newSharesCount < 0.01) {
          await sql`DELETE FROM positions WHERE id = ${position.id}`;
        } else {
          await sql`UPDATE positions SET shares = ${newSharesCount} WHERE id = ${position.id}`;
        }

        // Log transaction
        await sql`
          INSERT INTO transactions (user_id, outcome_id, type, shares, price_per_share, total_cost, balance_before, balance_after)
          VALUES (${user.id}, ${outcome.id}, 'sell', ${sharesToSell}, ${proceeds / sharesToSell}, ${proceeds}, ${user.balance}, ${newBalance})
        `;

        tradesExecuted++;
        tradeResults.push({
          bot: botName,
          action: "SELL",
          market: market.name,
          outcome: outcome.name,
          shares: sharesToSell,
          proceeds: proceeds.toFixed(2),
        });
      } else {
        // BUY: Original buy logic
        // Skip if balance too low
        if (Number(user.balance) < 20) continue;

        // Pick a random market
        const market = marketsResult[Math.floor(Math.random() * marketsResult.length)];
        const outcomes = market.outcomes || [];
        if (outcomes.length === 0) continue;

        // Pick a random outcome
        const outcomeIndex = Math.floor(Math.random() * outcomes.length);
        const outcome = outcomes[outcomeIndex];

        // Generate bet size (10-100, but not more than 30% of balance)
        const maxBet = Math.min(100, Number(user.balance) * 0.3);
        const betSize = Math.max(10, Math.floor(Math.random() * maxBet));

        // Calculate shares to buy based on current price
        const shares = outcomes.map((o: any) => Number(o.shares_outstanding));
        const totalExp = shares.reduce((sum: number, s: number) => sum + Math.exp(s / liquidityParam), 0);
        const currentPrice = Math.exp(Number(outcome.shares_outstanding) / liquidityParam) / totalExp;
        
        // Buy shares (rough estimate based on price)
        const sharesToBuy = Math.floor(betSize / Math.max(currentPrice, 0.1));
        if (sharesToBuy < 1) continue;

        // Execute trade via internal logic (simplified LMSR)
        const beforeCost = liquidityParam * Math.log(totalExp);
        const newShares = [...shares];
        newShares[outcomeIndex] += sharesToBuy;
        const newTotalExp = newShares.reduce((sum: number, s: number) => sum + Math.exp(s / liquidityParam), 0);
        const afterCost = liquidityParam * Math.log(newTotalExp);
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
          action: "BUY",
          market: market.name,
          outcome: outcome.name,
          shares: sharesToBuy,
          cost: cost.toFixed(2),
        });
      }
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
