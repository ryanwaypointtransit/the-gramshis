import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyAdminHeader } from "@/lib/auth/session";

// Initial liquidity for each outcome
const INITIAL_LIQUIDITY = 100;

// 9 Grammy categories for The Gramshis prediction market
const MARKETS = [
  {
    name: "Album of the Year",
    description: "Awarded for the overall production of an album",
    outcomes: [
      "DeBÍ TiRAR MáS FOToS - Bad Bunny",
      "MAYHEM - Lady Gaga",
      "GNX - Kendrick Lamar",
      "Let God Sort Em Out - Clipse",
      "Man's Best Friend - Sabrina Carpenter",
      "SWAG - Justin Bieber",
      "CHROMAKOPIA - Tyler, The Creator",
      "MUTT - Leon Thomas",
    ],
  },
  {
    name: "Record of the Year",
    description: "Awarded for the overall production of a single song",
    outcomes: [
      "luther - Kendrick Lamar & SZA",
      "APT. - ROSÉ & Bruno Mars",
      "Abracadabra - Lady Gaga",
      "DtMF - Bad Bunny",
      "WILDFLOWER - Billie Eilish",
      "Manchild - Sabrina Carpenter",
      "The Subway - Chappell Roan",
      "Anxiety - Doechii",
    ],
  },
  {
    name: "Song of the Year",
    description: "Awarded to the songwriter(s) of the best song of the year",
    outcomes: [
      "Golden - HUNTR/X",
      "luther - Kendrick Lamar & SZA",
      "DtMF - Bad Bunny",
      "WILDFLOWER - Billie Eilish",
      "Abracadabra - Lady Gaga",
      "Manchild - Sabrina Carpenter",
      "APT. - ROSÉ & Bruno Mars",
      "Anxiety - Doechii",
    ],
  },
  {
    name: "Best New Artist",
    description: "Awarded to the best new artist who releases their first recording",
    outcomes: [
      "Olivia Dean",
      "Leon Thomas",
      "Addison Rae",
      "KATSEYE",
      "Alex Warren",
      "sombr",
      "The Marias",
      "Lola Young",
    ],
  },
  {
    name: "Best Rap Album",
    description: "Awarded to the best rap album of the year",
    outcomes: [
      "GNX - Kendrick Lamar",
      "Let God Sort Em Out - Clipse",
      "CHROMAKOPIA - Tyler, The Creator",
      "God Does Like Ugly - JID",
      "GLORIOUS - GloRilla",
    ],
  },
  {
    name: "Best Música Urbana Album",
    description: "Awarded to the best Latin urban music album",
    outcomes: [
      "DeBÍ TiRAR MáS FOToS - Bad Bunny",
      "Mixteip - J Balvin",
      "FERXXO Vol X: Sagrado - Feid",
      "NAIKI - Nicki Nicole",
      "EUB Deluxe - Trueno",
      "SINFÓNICO (En Vivo) - Yandel",
    ],
  },
  {
    name: "Best Contemporary Country Album",
    description: "Awarded to the best contemporary country album",
    outcomes: [
      "Snipe Hunter - Zach Bryan",
      "Patterns - Jordan Davis",
      "Beautifully Broken - Jelly Roll",
      "Postcards From Texas - Flatland Cavalry",
      "Evangeline Vs. The Machine - Sierra Ferrell",
    ],
  },
  {
    name: "Best Pop Vocal Album",
    description: "Awarded to the best pop vocal album",
    outcomes: [
      "MAYHEM - Lady Gaga",
      "Man's Best Friend - Sabrina Carpenter",
      "I've Tried Everything But Therapy (Part 2) - Teddy Swims",
      "Something Beautiful - Miley Cyrus",
      "SWAG - Justin Bieber",
    ],
  },
  {
    name: "Best Pop Solo Performance",
    description: "Awarded to the best pop solo performance",
    outcomes: [
      "Daisies - Justin Bieber",
      "Manchild - Sabrina Carpenter",
      "Disease - Lady Gaga",
      "The Subway - Chappell Roan",
      "Messy - Lola Young",
    ],
  },
];

export async function POST(req: NextRequest) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { action } = await req.json();

    if (action === "reset-all") {
      // Clear everything and reseed
      await sql`DELETE FROM transactions`;
      await sql`DELETE FROM positions`;
      await sql`DELETE FROM admin_logs`;
      await sql`DELETE FROM outcomes`;
      await sql`DELETE FROM markets`;
      await sql`DELETE FROM users`;

      // Reseed markets
      let marketsCreated = 0;
      let outcomesCreated = 0;

      for (const market of MARKETS) {
        const result = await sql`
          INSERT INTO markets (name, description, status) 
          VALUES (${market.name}, ${market.description}, 'open')
          RETURNING id
        `;
        const marketId = (result[0] as { id: number }).id;
        marketsCreated++;

        for (let i = 0; i < market.outcomes.length; i++) {
          await sql`
            INSERT INTO outcomes (market_id, name, display_order, shares_outstanding) 
            VALUES (${marketId}, ${market.outcomes[i]}, ${i}, ${INITIAL_LIQUIDITY})
          `;
          outcomesCreated++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Reset complete. Created ${marketsCreated} markets with ${outcomesCreated} outcomes.`,
      });
    }

    if (action === "clear-users") {
      // Clear users and their related data
      await sql`DELETE FROM transactions`;
      await sql`DELETE FROM positions`;
      await sql`DELETE FROM users`;
      
      // Reset shares_outstanding to initial liquidity
      await sql`UPDATE outcomes SET shares_outstanding = ${INITIAL_LIQUIDITY}`;

      return NextResponse.json({
        success: true,
        message: "All users cleared and market prices reset.",
      });
    }

    if (action === "reset-prices") {
      // Just reset prices without clearing users
      await sql`UPDATE outcomes SET shares_outstanding = ${INITIAL_LIQUIDITY}`;

      return NextResponse.json({
        success: true,
        message: "Market prices reset to equal odds.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
