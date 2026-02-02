import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

// Bot names to filter by
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

export async function GET(req: NextRequest) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Get recent transactions from bot users
    const trades = await sql`
      SELECT 
        t.id,
        u.name as bot_name,
        o.name as outcome_name,
        m.name as market_name,
        t.shares,
        t.total_cost,
        t.created_at
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN outcomes o ON t.outcome_id = o.id
      JOIN markets m ON o.market_id = m.id
      WHERE u.name IN (
        'khia_asylum', 'connor_toups_burner', 'michalskrrrrrreta', 
        'saif_turkiye', 'dronestrikeryan', 'miguel_decafe_',
        'dogin5c', 'xxxadam_hargusxxx', 'catherine_oooooo', 
        'hisomeritsjonathonplsreply2mytxts'
      )
      ORDER BY t.created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({ trades });
  } catch (error) {
    console.error("Failed to fetch recent trades:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}
