import crypto from "crypto";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const KALSHI_API_KEY_ID = process.env.KALSHI_API_KEY_ID;
const KALSHI_PRIVATE_KEY_PATH = process.env.KALSHI_PRIVATE_KEY_PATH || "./Grammys.txt";
const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

// Map Kalshi event tickers to our market names - the 15 Grammy categories we're using
const KALSHI_TO_LOCAL_MAP: Record<string, string> = {
  // Big Four
  "KXGRAMSOTY-68": "Song Of The Year",
  "KXGRAMBNA-68": "Best New Artist",
  "KXGRAMAOTY-68": "Album Of The Year",
  "KXGRAMROTY-68": "Record Of The Year",
  // Pop categories
  "KXGRAMBPSP-68": "Best Pop Solo Performance",
  "KXGRAMBPDGP-68": "Best Pop Duo/Group Performance", 
  "KXGRAMBPVA-68": "Best Pop Vocal Album",
  // Rap categories
  "KXGRAMBRA-68": "Best Rap Album",
  "KXGRAMBRS-68": "Best Rap Song",
  // Alt categories
  "KXGRAMBAMP-68": "Best Alternative Music Performance",
  // Dance/Electronic categories
  "KXGRAMBDEA-68": "Best Dance/Electronic Album",
  "KXGRAMBDER-68": "Best Dance/Electronic Recording",
  "KXGRAMBDPR-68": "Best Dance Pop Recording",
  // Country categories
  "KXGRAMBCSP-68": "Best Country Solo Performance",
  "KXGRAMBCCA-68": "Best Contemporary Country Album",
  // Other categories
  "KXGRAMBRR-68": "Best Remixed Recording"
};

// All series to search - only those relevant to our 15 Grammy categories
const GRAMMY_SERIES = [
  // Big Four
  "KXGRAMSOTY",     // Song of the Year
  "KXGRAMBNA",      // Best New Artist
  "KXGRAMAOTY",     // Album of the Year
  "KXGRAMROTY",     // Record of the Year
  // Pop categories
  "KXGRAMBPSP",     // Best Pop Solo Performance
  "KXGRAMBPDGP",    // Best Pop Duo/Group Performance
  "KXGRAMBPVA",     // Best Pop Vocal Album
  // Rap categories
  "KXGRAMBRA",      // Best Rap Album
  "KXGRAMBRS",      // Best Rap Song
  // Alt categories
  "KXGRAMBAMP",     // Best Alternative Music Performance
  // Dance/Electronic categories
  "KXGRAMBDEA",     // Best Dance/Electronic Album
  "KXGRAMBDER",     // Best Dance/Electronic Recording
  "KXGRAMBDPR",     // Best Dance Pop Recording
  // Country categories
  "KXGRAMBCSP",     // Best Country Solo Performance
  "KXGRAMBCCA",     // Best Contemporary Country Album
  // Other categories
  "KXGRAMBRR",      // Best Remixed Recording
];

function loadPrivateKey(): string {
  const keyPath = path.resolve(process.cwd(), KALSHI_PRIVATE_KEY_PATH!);
  return fs.readFileSync(keyPath, "utf-8");
}

function signRequest(method: string, requestPath: string, timestamp: number): string {
  const privateKey = loadPrivateKey();
  const message = `${timestamp}${method}${requestPath}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  return sign.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }, "base64");
}

async function kalshiRequest(endpoint: string): Promise<any> {
  const timestamp = Date.now();
  const requestPath = `/trade-api/v2${endpoint}`;
  const signature = signRequest("GET", requestPath, timestamp);

  const response = await fetch(`${KALSHI_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID!,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestamp.toString(),
    },
  });

  if (!response.ok) {
    throw new Error(`Kalshi API error ${response.status}`);
  }
  return response.json();
}

interface KalshiOdds {
  outcomes: { name: string; probability: number }[];
}

async function fetchAllKalshiOdds(): Promise<Map<string, KalshiOdds>> {
  const results = new Map<string, KalshiOdds>();
  const seenEvents = new Set<string>();

  for (const series of GRAMMY_SERIES) {
    try {
      const data = await kalshiRequest(`/markets?series_ticker=${series}&limit=100&status=open`);
      const markets = data.markets || [];

      for (const m of markets) {
        const eventTicker = m.event_ticker;
        if (!eventTicker) continue;

        // Check if we have a mapping for this event
        const localName = KALSHI_TO_LOCAL_MAP[eventTicker];
        if (!localName || seenEvents.has(eventTicker)) continue;

        seenEvents.add(eventTicker);

        // Collect all markets for this event
        const eventMarkets = markets.filter((x: any) => x.event_ticker === eventTicker);
        const outcomes = eventMarkets
          .filter((x: any) => x.yes_sub_title !== "Tie")
          .map((x: any) => ({
            name: x.yes_sub_title || x.title,
            probability: (x.last_price || x.yes_bid || 0) / 100,
          }))
          .sort((a: any, b: any) => b.probability - a.probability);

        results.set(localName, { outcomes });
      }
    } catch (e) {
      // Skip failed series
    }
  }

  return results;
}

function normalizeOutcomeName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function findBestMatch(kalshiName: string, localOutcomes: string[]): string | null {
  const normalized = normalizeOutcomeName(kalshiName);

  for (const local of localOutcomes) {
    const localNorm = normalizeOutcomeName(local);
    if (localNorm === normalized || localNorm.includes(normalized) || normalized.includes(localNorm)) {
      return local;
    }
  }

  // Match first significant word
  const firstWord = normalized.split(" ")[0];
  if (firstWord.length > 3) {
    for (const local of localOutcomes) {
      if (normalizeOutcomeName(local).split(" ")[0] === firstWord) {
        return local;
      }
    }
  }

  return null;
}

async function main() {
  if (!KALSHI_API_KEY_ID) {
    console.error("Missing KALSHI_API_KEY_ID");
    process.exit(1);
  }

  console.log("Fetching Grammy odds from Kalshi API...\n");
  const kalshiOdds = await fetchAllKalshiOdds();

  // Fetch local markets from Postgres
  const localMarketsResult = await sql`
    SELECT m.name, o.name as outcome_name 
    FROM markets m 
    JOIN outcomes o ON o.market_id = m.id 
    ORDER BY m.id, o.display_order
  `;
  const localMarkets = localMarketsResult as { name: string; outcome_name: string }[];

  // Group local outcomes by market
  const localByMarket = new Map<string, string[]>();
  for (const row of localMarkets) {
    if (!localByMarket.has(row.name)) localByMarket.set(row.name, []);
    localByMarket.get(row.name)!.push(row.outcome_name);
  }

  console.log("=" .repeat(60));
  console.log("KALSHI GRAMMY ODDS (matched to local markets)");
  console.log("=".repeat(60));

  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const [marketName, data] of kalshiOdds) {
    console.log(`\n${marketName}`);
    console.log("-".repeat(50));

    const localOutcomes = localByMarket.get(marketName) || [];

    for (const o of data.outcomes) {
      const match = findBestMatch(o.name, localOutcomes);
      const pct = (o.probability * 100).toFixed(1).padStart(5);
      if (match) {
        console.log(`  ${pct}%  ${o.name} → ${match}`);
        totalMatched++;
      } else {
        console.log(`  ${pct}%  ${o.name} → ❌ NO MATCH`);
        totalUnmatched++;
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`SUMMARY: ${kalshiOdds.size} markets from Kalshi, ${totalMatched} outcomes matched, ${totalUnmatched} unmatched`);
  console.log("=".repeat(60));

  // Show which local markets don't have Kalshi data
  const kalshiMarkets = new Set(kalshiOdds.keys());
  const missingMarkets = [...localByMarket.keys()].filter(m => !kalshiMarkets.has(m));

  if (missingMarkets.length > 0) {
    console.log(`\nLocal markets WITHOUT Kalshi odds (${missingMarkets.length}):`);
    missingMarkets.forEach(m => console.log(`  - ${m}`));
  }
}

main().catch(console.error);
