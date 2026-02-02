import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

interface MarketSeed {
  name: string;
  description: string;
  outcomes: string[];
}

// 2026 Grammy Awards (68th Annual) - February 1, 2026
// 9 Grammy categories for The Gramshis prediction market
const markets: MarketSeed[] = [
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

async function initSchema() {
  console.log("Initializing database schema...\n");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      balance DECIMAL(10,2) DEFAULT 1000.00,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS markets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'paused', 'resolved')),
      liquidity_param DECIMAL(10,2) DEFAULT 100,
      winning_outcome_id INTEGER,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS outcomes (
      id SERIAL PRIMARY KEY,
      market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      shares_outstanding DECIMAL(10,4) DEFAULT 0,
      display_order INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS positions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
      shares DECIMAL(10,4) DEFAULT 0,
      avg_cost_basis DECIMAL(10,4) DEFAULT 0,
      UNIQUE(user_id, outcome_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'payout')),
      shares DECIMAL(10,4) NOT NULL,
      price_per_share DECIMAL(10,4) NOT NULL,
      total_cost DECIMAL(10,2) NOT NULL,
      balance_before DECIMAL(10,2) NOT NULL,
      balance_after DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      admin_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create indexes
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_outcomes_market ON outcomes(market_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_positions_outcome ON positions(outcome_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_outcome ON transactions(outcome_id)`;
  } catch {
    // Indexes might already exist
  }

  console.log("Schema initialized!\n");
}

async function clearMarkets() {
  console.log("Clearing existing markets...\n");
  
  // Delete in order due to foreign key constraints
  await sql`DELETE FROM transactions WHERE outcome_id IN (SELECT id FROM outcomes)`;
  await sql`DELETE FROM positions WHERE outcome_id IN (SELECT id FROM outcomes)`;
  await sql`DELETE FROM admin_logs WHERE target_type = 'market'`;
  await sql`DELETE FROM outcomes`;
  await sql`DELETE FROM markets`;
  
  console.log("Existing markets cleared!\n");
}

async function seedMarkets() {
  console.log("Starting market seed...\n");

  let marketsCreated = 0;
  let outcomesCreated = 0;

  for (const market of markets) {
    try {
      const result = await sql`
        INSERT INTO markets (name, description, status) 
        VALUES (${market.name}, ${market.description}, 'draft')
        RETURNING id
      `;
      const marketId = (result[0] as { id: number }).id;
      marketsCreated++;
      console.log(`Created market: ${market.name} (ID: ${marketId})`);

      for (let i = 0; i < market.outcomes.length; i++) {
        await sql`
          INSERT INTO outcomes (market_id, name, display_order) 
          VALUES (${marketId}, ${market.outcomes[i]}, ${i})
        `;
        outcomesCreated++;
      }
      console.log(`  Added ${market.outcomes.length} nominees\n`);
    } catch (error) {
      console.error(`Error creating market "${market.name}":`, error);
    }
  }

  console.log("=".repeat(50));
  console.log(`Seed complete!`);
  console.log(`Markets created: ${marketsCreated}`);
  console.log(`Outcomes created: ${outcomesCreated}`);
  console.log("\nMarkets are in 'draft' status. Use the admin panel to:");
  console.log("1. Set initial odds for each market");
  console.log("2. Open markets for trading");
}

// Run the seed
async function main() {
  try {
    await initSchema();
    await clearMarkets();
    await seedMarkets();
    console.log("\nDone!");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
