import { NextRequest, NextResponse } from "next/server";
import { sql, Market, Outcome } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";
import { calculatePrices } from "@/lib/market-maker/lmsr";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { id } = await params;
    const marketId = parseInt(id, 10);

    const marketResult = await sql`SELECT * FROM markets WHERE id = ${marketId}`;
    const market = marketResult.rows[0] as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const outcomesResult = await sql`
      SELECT * FROM outcomes WHERE market_id = ${marketId} ORDER BY display_order
    `;
    const outcomes = outcomesResult.rows as Outcome[];

    const shares = outcomes.map((o) => Number(o.shares_outstanding));
    const prices = calculatePrices(shares, Number(market.liquidity_param));

    return NextResponse.json({
      market: {
        ...market,
        liquidity_param: Number(market.liquidity_param),
        outcomes: outcomes.map((o, i) => ({
          ...o,
          shares_outstanding: Number(o.shares_outstanding),
          price: prices[i],
        })),
      },
    });
  } catch (error) {
    console.error("Admin market fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch market" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminHeader(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    const { id } = await params;
    const marketId = parseInt(id, 10);
    const { status, name, description } = await request.json();

    const marketResult = await sql`SELECT * FROM markets WHERE id = ${marketId}`;
    const market = marketResult.rows[0] as Market | undefined;

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Validate status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        draft: ["open"],
        open: ["paused", "resolved"],
        paused: ["open", "resolved"],
        resolved: [],
      };

      if (!validTransitions[market.status]?.includes(status)) {
        return NextResponse.json(
          { error: `Cannot change status from ${market.status} to ${status}` },
          { status: 400 }
        );
      }
    }

    // Build and execute updates
    if (status && name && description !== undefined) {
      await sql`UPDATE markets SET status = ${status}, name = ${name}, description = ${description} WHERE id = ${marketId}`;
    } else if (status && name) {
      await sql`UPDATE markets SET status = ${status}, name = ${name} WHERE id = ${marketId}`;
    } else if (status && description !== undefined) {
      await sql`UPDATE markets SET status = ${status}, description = ${description} WHERE id = ${marketId}`;
    } else if (name && description !== undefined) {
      await sql`UPDATE markets SET name = ${name}, description = ${description} WHERE id = ${marketId}`;
    } else if (status) {
      await sql`UPDATE markets SET status = ${status} WHERE id = ${marketId}`;
    } else if (name) {
      await sql`UPDATE markets SET name = ${name} WHERE id = ${marketId}`;
    } else if (description !== undefined) {
      await sql`UPDATE markets SET description = ${description} WHERE id = ${marketId}`;
    } else {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    // Log admin action (system/anonymous)
    await sql`
      INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) 
      VALUES (${0}, ${'update_market'}, ${'market'}, ${marketId}, ${JSON.stringify({ status, name, description })})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update market error:", error);
    return NextResponse.json({ error: "Failed to update market" }, { status: 500 });
  }
}
