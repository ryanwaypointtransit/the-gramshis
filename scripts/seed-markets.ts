import { sql } from "@vercel/postgres";

interface MarketSeed {
  name: string;
  description: string;
  outcomes: string[];
}

// 2026 Grammy Awards (68th Annual) - February 1, 2026
// Final 15 Grammy categories we are using based on Kalshi availability
const markets: MarketSeed[] = [
  {
    name: "Song Of The Year",
    description: "Awarded to the songwriter(s) of the best song of the year",
    outcomes: [
      "Abracadabra - Lady Gaga",
      "Anxiety - Doechii",
      "APT. - ROSÉ & Bruno Mars",
      "DtMF - Bad Bunny",
      "Golden - HUNTR/X",
      "luther - Kendrick Lamar & SZA",
      "Manchild - Sabrina Carpenter",
      "WILDFLOWER - Billie Eilish",
    ],
  },
  {
    name: "Best New Artist",
    description: "Awarded to the best new artist who releases their first recording",
    outcomes: [
      "Olivia Dean",
      "KATSEYE",
      "The Marias",
      "Addison Rae",
      "sombr",
      "Leon Thomas",
      "Alex Warren",
      "Lola Young",
    ],
  },
  {
    name: "Album Of The Year",
    description: "Awarded for the overall production of an album",
    outcomes: [
      "DeBÍ TiRAR MáS FOToS - Bad Bunny",
      "SWAG - Justin Bieber",
      "Man's Best Friend - Sabrina Carpenter",
      "Let God Sort Em Out - Clipse",
      "MAYHEM - Lady Gaga",
      "GNX - Kendrick Lamar",
      "MUTT - Leon Thomas",
      "CHROMAKOPIA - Tyler, The Creator",
    ],
  },
  {
    name: "Record Of The Year",
    description: "Awarded for the overall production of a single song",
    outcomes: [
      "DtMF - Bad Bunny",
      "Manchild - Sabrina Carpenter",
      "Anxiety - Doechii",
      "WILDFLOWER - Billie Eilish",
      "Abracadabra - Lady Gaga",
      "luther - Kendrick Lamar & SZA",
      "The Subway - Chappell Roan",
      "APT. - ROSÉ & Bruno Mars",
    ],
  },
  {
    name: "Best Rap Album",
    description: "Awarded to the best rap album of the year",
    outcomes: [
      "Let God Sort Em Out - Clipse",
      "GLORIOUS - GloRilla",
      "God Does Like Ugly - JID",
      "GNX - Kendrick Lamar",
      "CHROMAKOPIA - Tyler, The Creator",
    ],
  },
  {
    name: "Best Pop Duo/Group Performance",
    description: "Awarded to the best pop collaboration",
    outcomes: [
      "Defying Gravity - Cynthia Erivo & Ariana Grande",
      "Golden - HUNTR/X",
      "Gabriela - KATSEYE",
      "APT. - ROSÉ & Bruno Mars",
      "30 For 30 - SZA feat. Kendrick Lamar",
    ],
  },
  {
    name: "Best Pop Vocal Album",
    description: "Awarded to the best pop vocal album",
    outcomes: [
      "SWAG - Justin Bieber",
      "Man's Best Friend - Sabrina Carpenter",
      "Something Beautiful - Miley Cyrus",
      "MAYHEM - Lady Gaga",
      "I've Tried Everything But Therapy Part 2 - Teddy Swims",
    ],
  },
  {
    name: "Best Pop Solo Performance",
    description: "Awarded to the best pop solo performance",
    outcomes: [
      "DAISIES - Justin Bieber",
      "Manchild - Sabrina Carpenter",
      "Disease - Lady Gaga",
      "The Subway - Chappell Roan",
      "Messy - Lola Young",
    ],
  },
  {
    name: "Best Rap Song",
    description: "Awarded to the songwriter(s) of the best rap song",
    outcomes: [
      "Anxiety - Doechii",
      "The Birds Don't Sing - Clipse, John Legend & Voices of Fire",
      "Sticky - Tyler, The Creator, GloRilla, Sexyy Red & Lil Wayne",
      "TGIF - GloRilla",
      "tv off - Kendrick Lamar & Lefty Gunplay",
    ],
  },
  {
    name: "Best Rap Performance",
    description: "Awarded to the best rap performance",
    outcomes: [
      "Outside - Cardi B",
      "Chains & Whips - Clipse, Pharrell Williams & Kendrick Lamar",
      "Anxiety - Doechii",
      "tv off - Kendrick Lamar & Lefty Gunplay",
      "Darling, I - Tyler, The Creator & Teezo Touchdown",
    ],
  },
  {
    name: "Best R&B Song",
    description: "Awarded to the songwriter(s) of the best R&B song",
    outcomes: [
      "Folded - Kehlani",
      "Heart Of A Woman - Summer Walker",
      "It Depends - Chris Brown & Bryson Tiller",
      "Overqualified - Durand Bernarr",
      "YES IT IS - Leon Thomas",
    ],
  },
  {
    name: "Best Rock Performance",
    description: "Awarded to the best rock performance",
    outcomes: [
      "U Should Not Be Doing That - Amyl and The Sniffers",
      "The Emptiness Machine - Linkin Park",
      "NEVER ENOUGH - Turnstile",
      "Mirtazapine - Hayley Williams",
      "Changes (Live From Villa Park) - YUNGBLUD feat. Nuno Bettencourt",
    ],
  },
  {
    name: "Best Alternative Music Album",
    description: "Awarded to the best alternative music album",
    outcomes: [
      "SABLE, fABLE - Bon Iver",
      "Songs Of A Lost World - The Cure",
      "DON'T TAP THE GLASS - Tyler, The Creator",
      "moisturizer - Wet Leg",
      "Ego Death At A Bachelorette Party - Hayley Williams",
    ],
  },
  {
    name: "Best Rock Song",
    description: "Awarded to the songwriter(s) of the best rock song",
    outcomes: [
      "As Alive As You Need Me To Be - Trent Reznor & Atticus Ross",
      "Caramel - Vessel & II",
      "Glum - Daniel James & Hayley Williams",
      "NEVER ENOUGH - Turnstile",
      "Zombie - YUNGBLUD",
    ],
  },
  {
    name: "Best Remixed Recording",
    description: "Awarded to the best remixed recording",
    outcomes: [
      "Abracadabra (Gesaffelstein Remix) - Lady Gaga",
      "Don't Forget About Us (KAYTRANADA Remix) - Mariah Carey",
      "A Dreams A Dream (Ron Trent Remix) - Soul II Soul",
      "Galvanize (Chris Lake Remix) - The Chemical Brothers",
      "Golden (David Guetta Remix) - HUNTR/X",
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

  // Create indexes (IF NOT EXISTS is implicit for CREATE INDEX in some versions)
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

async function seedMarkets() {
  console.log("Starting market seed...\n");

  let marketsCreated = 0;
  let outcomesCreated = 0;

  for (const market of markets) {
    try {
      // Check if market already exists
      const existing = await sql`SELECT id FROM markets WHERE name = ${market.name}`;
      if (existing.rows.length > 0) {
        console.log(`Market already exists: ${market.name} (skipping)`);
        continue;
      }

      const result = await sql`
        INSERT INTO markets (name, description, status)
        VALUES (${market.name}, ${market.description}, 'draft')
        RETURNING id
      `;
      const marketId = result.rows[0].id;
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
    await seedMarkets();
    console.log("\nDone!");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
