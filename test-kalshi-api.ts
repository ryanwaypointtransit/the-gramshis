import crypto from "crypto";
import fs from "fs";
import path from "path";

const KALSHI_API_KEY_ID = process.env.KALSHI_API_KEY_ID;
const KALSHI_PRIVATE_KEY_PATH = process.env.KALSHI_PRIVATE_KEY_PATH || "./Grammys.txt";
const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

// Grammy series tickers - Final list of categories to keep
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
  // Rock/Alt categories
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
  const keyPath = path.resolve(process.cwd(), KALSHI_PRIVATE_KEY_PATH);
  return fs.readFileSync(keyPath, "utf-8");
}

function signRequest(method: string, requestPath: string, timestamp: number): string {
  const privateKey = loadPrivateKey();
  const message = `${timestamp}${method}${requestPath}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  sign.end();

  const signature = sign.sign(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    "base64"
  );

  return signature;
}

async function kalshiRequest(endpoint: string): Promise<any> {
  const timestamp = Date.now();
  const requestPath = `/trade-api/v2${endpoint}`;
  const signature = signRequest("GET", requestPath, timestamp);

  const response = await fetch(`${KALSHI_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": timestamp.toString(),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kalshi API error ${response.status}: ${text}`);
  }

  return response.json();
}

// Save odds to JSON file
function saveToJson(data: any, filename: string): void {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Data saved to ${filename}`);
}

async function fetchGrammyMarketsBySeries(): Promise<void> {
  console.log("Fetching Grammy markets from Kalshi...\n");

  const results: Record<string, { name: string; outcomes: { name: string; probability: number }[] }> = {};
  let foundCategories = 0;

  // Helper function to map series tickers to readable names
  function getReadableName(ticker: string): string {
    // For event tickers like KXGRAMBRS-68, extract the base part
    const baseTicker = ticker.split('-')[0];
    
    const nameMap: Record<string, string> = {
      "KXGRAMSOTY": "Song of the Year",
      "KXGRAMBNA": "Best New Artist",
      "KXGRAMAOTY": "Album of the Year",
      "KXGRAMROTY": "Record of the Year",
      "KXGRAMBPSP": "Best Pop Solo Performance",
      "KXGRAMBPDGP": "Best Pop Duo/Group Performance",
      "KXGRAMBPVA": "Best Pop Vocal Album",
      "KXGRAMBTPVA": "Best Traditional Pop Vocal Album",
      "KXGRAMBRA": "Best Rap Album",
      "KXGRAMBRS": "Best Rap Song",
      "KXGRAMBRP": "Best Rap Performance",
      "KXGRAMBMRP": "Best Melodic Rap Performance",
      "KXGRAMBR&BS": "Best R&B Song",
      "KXGRAMBR&BP": "Best R&B Performance",
      "KXGRAMBPR&BA": "Best Progressive R&B Album",
      "KXGRAMBTR&BP": "Best Traditional R&B Performance",
      "KXGRAMBROS": "Best Rock Song",
      "KXGRAMBRKP": "Best Rock Performance",
      "KXGRAMBAMA": "Best Alternative Music Album",
      "KXGRAMBAMP": "Best Alternative Music Performance",
      "KXGRAMBMP": "Best Metal Performance",
      "KXGRAMBDEA": "Best Dance/Electronic Album",
      "KXGRAMBDER": "Best Dance/Electronic Recording",
      "KXGRAMBDPR": "Best Dance Pop Recording",
      "KXGRAMBCSP": "Best Country Solo Performance",
      "KXGRAMBCDGP": "Best Country Duo/Group Performance",
      "KXGRAMBCCA": "Best Contemporary Country Album",
      "KXGRAMBTCA": "Best Traditional Country Album",
      "KXGRAMSOTY-NC": "Songwriter of the Year, Non-Classical",
      "KXGRAMBRR": "Best Remixed Recording",
      "KXGRAMBSWPA": "Best Spoken Word Poetry Album"
    };
    
    return nameMap[baseTicker] || ticker;
  }

  for (const seriesTicker of GRAMMY_SERIES) {
    try {
      // Get markets for this series
      const marketsData = await kalshiRequest(`/markets?series_ticker=${seriesTicker}&limit=100&status=open`);
      const markets = marketsData.markets || [];

      if (markets.length === 0) {
        // Only log if we're in verbose mode
        // console.log(`No markets found for ${seriesTicker}`);
        continue;
      }

      // Group markets by event (each Grammy category is an "event")
      const byEvent: Record<string, any[]> = {};
      for (const m of markets) {
        const eventTicker = m.event_ticker || seriesTicker;
        if (!byEvent[eventTicker]) byEvent[eventTicker] = [];
        byEvent[eventTicker].push(m);
      }

      for (const [eventTicker, eventMarkets] of Object.entries(byEvent)) {
        // Get event name from first market, or map from ticker, or use event_ticker
        const eventTitle = eventMarkets[0]?.event_title;
        const mappedName = getReadableName(eventTicker);
        const eventName = eventTitle || mappedName || eventTicker;
        
        foundCategories++;

        // Prices are in cents (0-100), so divide by 100 to get decimal probability
        const outcomes = eventMarkets
          .filter((m: any) => m.yes_sub_title !== "Tie") // Exclude "Tie" outcomes
          .map((m: any) => ({
            name: m.yes_sub_title || m.title,
            probability: (m.last_price || m.yes_bid || 0) / 100,
          }));

        // Sort by probability descending
        outcomes.sort((a: any, b: any) => b.probability - a.probability);

        // Use mapped name as key to make it more readable
        results[eventName] = { name: eventName, outcomes };
      }
    } catch (e) {
      console.error(`Error fetching ${seriesTicker}:`, e);
    }
    
    // Add longer delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`Found ${foundCategories} Grammy categories with odds\n`);

  // Output results
  console.log("=".repeat(60));
  console.log("KALSHI GRAMMY ODDS");
  console.log("=".repeat(60));

  for (const [category, data] of Object.entries(results)) {
    console.log(`\n${data.name}`);
    console.log("-".repeat(50));
    for (const outcome of data.outcomes) {
      const pct = (outcome.probability * 100).toFixed(1).padStart(5);
      console.log(`  ${pct}%  ${outcome.name}`);
    }
  }
  
  // Save to JSON file for easier integration
  saveToJson(results, 'grammy-odds.json');
}

// Main
if (!KALSHI_API_KEY_ID) {
  console.error("Missing KALSHI_API_KEY_ID environment variable");
  process.exit(1);
}

fetchGrammyMarketsBySeries().catch(console.error);