import crypto from "crypto";
import fs from "fs";
import path from "path";

const KALSHI_API_KEY_ID = process.env.KALSHI_API_KEY_ID;
const KALSHI_PRIVATE_KEY_PATH = process.env.KALSHI_PRIVATE_KEY_PATH || "./Grammys.txt";
const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

// Grammy market tickers on Kalshi (2026 / 68th Annual)
const GRAMMY_MARKETS = [
  { ticker: "KXGRAMSOTY-68", name: "Song Of The Year" },
  { ticker: "KXGRAMBNA-68", name: "Best New Artist" },
  { ticker: "KXGRAMAOTY-68", name: "Album Of The Year" },
  { ticker: "KXGRAMROTY-68", name: "Record Of The Year" },
  { ticker: "KXGRAMBRA-68", name: "Best Rap Album" },
  { ticker: "KXGRAMBPDGP-68", name: "Best Pop Duo/Group Performance" },
  { ticker: "KXGRAMBPVA-68", name: "Best Pop Vocal Album" },
  { ticker: "KXGRAMBPSP-68", name: "Best Pop Solo Performance" },
  { ticker: "KXGRAMBRS-68", name: "Best Rap Song" },
  { ticker: "KXGRAMBRP-68", name: "Best Rap Performance" },
  { ticker: "KXGRAMBR&BS-68", name: "Best R&B Song" },
  { ticker: "KXGRAMBRKP-68", name: "Best Rock Performance" },
  { ticker: "KXGRAMBAMA-68", name: "Best Alternative Music Album" },
  { ticker: "KXGRAMBRKS-68", name: "Best Rock Song" },
  { ticker: "KXGRAMBR&BP-68", name: "Best R&B Performance" },
  { ticker: "KXGRAMBDEA-68", name: "Best Dance/Electronic Album" },
  { ticker: "KXGRAMBDPR-68", name: "Best Dance Pop Recording" },
  { ticker: "KXGRAMSOTY-NC-68", name: "Songwriter Of The Year, Non-Classical" },
  { ticker: "KXGRAMBMP-68", name: "Best Metal Performance" },
  { ticker: "KXGRAMBDER-68", name: "Best Dance/Electronic Recording" },
  { ticker: "KXGRAMBPR&BA-68", name: "Best Progressive R&B Album" },
  { ticker: "KXGRAMBTR&BP-68", name: "Best Traditional R&B Performance" },
  { ticker: "KXGRAMBCCA-68", name: "Best Contemporary Country Album" },
  { ticker: "KXGRAMBMRP-68", name: "Best Melodic Rap Performance" },
  { ticker: "KXGRAMBAMP-68", name: "Best Alternative Music Performance" },
  { ticker: "KXGRAMBTPVA-68", name: "Best Traditional Pop Vocal Album" },
  { ticker: "KXGRAMBCSP-68", name: "Best Country Solo Performance" },
  { ticker: "KXGRAMBTCA-68", name: "Best Traditional Country Album" },
  { ticker: "KXGRAMBCDGP-68", name: "Best Country Duo/Group Performance" },
  { ticker: "KXGRAMBRR-68", name: "Best Remixed Recording" },
  { ticker: "KXGRAMBSWPA-68", name: "Best Spoken Word Poetry Album" },
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
      "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID!,
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

async function fetchMarketOdds(ticker: string): Promise<{ name: string; probability: number }[] | null> {
  try {
    // First try to get the event which contains all markets
    const data = await kalshiRequest(`/markets/${ticker}`);

    if (data.market) {
      const market = data.market;
      // For binary markets, yes_price is the probability
      return [{
        name: market.yes_sub_title || market.title,
        probability: market.yes_price || 0,
      }];
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch ${ticker}:`, error);
    return null;
  }
}

async function fetchEventMarkets(seriesTicker: string): Promise<any[]> {
  try {
    const data = await kalshiRequest(`/markets?series_ticker=${seriesTicker}&limit=100`);
    return data.markets || [];
  } catch (error) {
    console.error(`Failed to fetch markets for series ${seriesTicker}:`, error);
    return [];
  }
}

async function discoverGrammyMarkets(): Promise<void> {
  console.log("Discovering Grammy markets on Kalshi...\n");

  // Try to find all Grammy-related series
  const seriesTickers = ["KXGRAMSOTY", "KXGRAMAOTY", "KXGRAMROTY", "KXGRAMBNA"];

  for (const series of seriesTickers) {
    console.log(`\n=== ${series} ===`);
    const markets = await fetchEventMarkets(series);

    for (const market of markets) {
      console.log(`Ticker: ${market.ticker}`);
      console.log(`Title: ${market.title}`);
      console.log(`Yes Price: ${market.yes_price}`);
      console.log(`Status: ${market.status}`);
      console.log("---");
    }
  }
}

async function fetchAllGrammyOdds(): Promise<void> {
  console.log("Fetching Grammy odds from Kalshi...\n");

  // Try different approaches to find Grammy markets

  // 1. Search events with different patterns
  const eventSearches = [
    "/events?limit=200",
    "/events/multivariate?limit=200",
  ];

  let allEvents: any[] = [];

  for (const endpoint of eventSearches) {
    try {
      const data = await kalshiRequest(endpoint);
      const events = data.events || [];
      allEvents = allEvents.concat(events);
    } catch (e) {
      console.log(`Endpoint ${endpoint} failed`);
    }
  }

  // Filter for Grammy-related events
  const grammyEvents = allEvents.filter((e: any) =>
    e.title?.toLowerCase().includes("grammy") ||
    e.event_ticker?.toLowerCase().includes("gram") ||
    e.series_ticker?.toLowerCase().includes("gram")
  );

  console.log(`Found ${grammyEvents.length} Grammy events:`);
  for (const event of grammyEvents) {
    console.log(`\n=== ${event.title} (${event.event_ticker}) ===`);
    console.log(`Series: ${event.series_ticker}`);
    console.log(`Status: ${event.status}`);
  }

  // 2. If we found events, fetch their markets
  if (grammyEvents.length > 0) {
    for (const event of grammyEvents) {
      try {
        const marketsData = await kalshiRequest(`/markets?event_ticker=${event.event_ticker}&limit=100`);
        const markets = marketsData.markets || [];

        console.log(`\n--- Markets for ${event.title} ---`);

        // Sort by probability descending
        markets.sort((a: any, b: any) => (b.yes_price || 0) - (a.yes_price || 0));

        for (const m of markets) {
          const prob = ((m.yes_price || 0) * 100).toFixed(1);
          const name = m.yes_sub_title || m.title;
          console.log(`  ${prob}% - ${name}`);
        }
      } catch (e) {
        console.error(`Failed to fetch markets for ${event.event_ticker}`);
      }
    }
  } else {
    // 3. Try direct market search as fallback
    console.log("\nNo Grammy events found, trying direct market search...");
    try {
      const marketsData = await kalshiRequest("/markets?limit=500&status=open");
      const grammyMarkets = (marketsData.markets || []).filter((m: any) =>
        m.title?.toLowerCase().includes("grammy") ||
        m.event_ticker?.toLowerCase().includes("gram") ||
        m.ticker?.toLowerCase().includes("gram")
      );

      console.log(`Found ${grammyMarkets.length} Grammy markets in open markets`);

      // Group by event
      const byEvent: Record<string, any[]> = {};
      for (const market of grammyMarkets) {
        const eventTicker = market.event_ticker || "unknown";
        if (!byEvent[eventTicker]) byEvent[eventTicker] = [];
        byEvent[eventTicker].push(market);
      }

      for (const [eventTicker, markets] of Object.entries(byEvent)) {
        console.log(`\n=== ${eventTicker} ===`);
        markets.sort((a: any, b: any) => (b.yes_price || 0) - (a.yes_price || 0));
        for (const m of markets) {
          const prob = ((m.yes_price || 0) * 100).toFixed(1);
          console.log(`  ${prob}% - ${m.yes_sub_title || m.title}`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch markets:", error);
    }
  }
}

async function debugListAll(): Promise<void> {
  console.log("Listing all available events and series...\n");

  // Get all series
  try {
    const seriesData = await kalshiRequest("/series?limit=200");
    console.log(`Found ${seriesData.series?.length || 0} series`);

    // Look for entertainment/awards related
    const relevantSeries = (seriesData.series || []).filter((s: any) =>
      s.title?.toLowerCase().includes("grammy") ||
      s.title?.toLowerCase().includes("award") ||
      s.title?.toLowerCase().includes("music") ||
      s.title?.toLowerCase().includes("entertainment") ||
      s.ticker?.toLowerCase().includes("gram")
    );

    console.log("\nRelevant series found:");
    for (const s of relevantSeries) {
      console.log(`  ${s.ticker}: ${s.title}`);
    }

    // List ALL series to see what's available
    console.log("\nAll series tickers:");
    for (const s of seriesData.series || []) {
      console.log(`  ${s.ticker}: ${s.title}`);
    }
  } catch (e) {
    console.error("Failed to fetch series:", e);
  }

  // Get multivariate events (Grammy categories are likely multivariate)
  try {
    const mvData = await kalshiRequest("/events/multivariate?limit=100");
    console.log(`\nFound ${mvData.events?.length || 0} multivariate events`);

    const grammyMV = (mvData.events || []).filter((e: any) =>
      e.title?.toLowerCase().includes("grammy") ||
      e.event_ticker?.toLowerCase().includes("gram")
    );

    console.log("\nGrammy multivariate events:");
    for (const e of grammyMV) {
      console.log(`  ${e.event_ticker}: ${e.title}`);
    }

    // Show all multivariate events
    console.log("\nAll multivariate events:");
    for (const e of mvData.events || []) {
      console.log(`  ${e.event_ticker}: ${e.title}`);
    }
  } catch (e) {
    console.error("Failed to fetch multivariate events:", e);
  }
}

// Grammy series tickers discovered from Kalshi (expanded list)
const GRAMMY_SERIES = [
  // Big Four
  "KXGRAMSOTY",     // Song of the Year
  "KXGRAMBNA",      // Best New Artist
  "KXGRAMAOTY",     // Album of the Year
  "GRAMAOTY",       // Album of the Year (alt)
  "KXGRAMROTY",     // Record of the Year
  "GRAMROTY",       // Record of the Year (alt)
  // Rap
  "KXGRAMRAOTY",    // Rap Album of the Year
  "KXGRAMBRA",      // Best Rap Album
  "GRAMBRA",        // Best Rap Album (alt)
  "KXGRAMBRS",      // Best Rap Song
  "GRAMBRS",        // Best Rap Song (alt)
  "KXGRAMBRP",      // Best Rap Performance
  "KXGRAMBMRP",     // Best Melodic Rap Performance
  // Pop
  "KXGRAMBPDGP",    // Best Pop Duo/Group Performance
  "KXGRAMBPVA",     // Best Pop Vocal Album
  "KXGRAMBPSP",     // Best Pop Solo Performance
  "KXGRAMBDPR",     // Best Dance Pop Recording
  "KXGRAMBTPVA",    // Best Traditional Pop Vocal Album
  // R&B
  "KXGRAMBRNBA",    // Best R&B Album
  "KXGRAMBR&BS",    // Best R&B Song
  "KXGRAMBR&BP",    // Best R&B Performance
  "KXGRAMBPRNBA",   // Best Progressive R&B Album
  "KXGRAMBTR&BP",   // Best Traditional R&B Performance
  // Rock/Alt/Metal
  "KXGRAMBROS",     // Best Rock Song
  "KXGRAMBRKP",     // Best Rock Performance
  "KXGRAMBAMA",     // Best Alternative Music Album
  "KXGRAMBAMP",     // Best Alternative Music Performance
  "KXGRAMBMP",      // Best Metal Performance
  // Dance/Electronic
  "KXGRAMBDEA",     // Best Dance/Electronic Album
  "KXGRAMBDER",     // Best Dance/Electronic Recording
  // Country
  "KXGRAMBCSP",     // Best Country Solo Performance
  "KXGRAMBCDGP",    // Best Country Duo/Group Performance
  "KXGRAMBCCA",     // Best Contemporary Country Album
  "KXGRAMBTCA",     // Best Traditional Country Album
  "KXGRAMBCA",      // Best Country Album
  // Other
  "KXGRAMPOTY",     // Producer of the Year
  "KXGRAMSOTYNC",   // Songwriter of the Year Non-Classical
  "KXGRAMBRR",      // Best Remixed Recording
  "KXGRAMBSWPA",    // Best Spoken Word Poetry Album
];

async function fetchGrammyMarketsBySeries(): Promise<void> {
  console.log("Fetching Grammy markets from Kalshi...\n");

  const results: Record<string, { name: string; outcomes: { name: string; probability: number }[] }> = {};

  for (const seriesTicker of GRAMMY_SERIES) {
    try {
      // Get markets for this series
      const marketsData = await kalshiRequest(`/markets?series_ticker=${seriesTicker}&limit=100&status=open`);
      const markets = marketsData.markets || [];

      if (markets.length === 0) continue;

      // Group markets by event (each Grammy category is an "event")
      const byEvent: Record<string, any[]> = {};
      for (const m of markets) {
        const eventTicker = m.event_ticker || seriesTicker;
        if (!byEvent[eventTicker]) byEvent[eventTicker] = [];
        byEvent[eventTicker].push(m);
      }

      for (const [eventTicker, eventMarkets] of Object.entries(byEvent)) {
        // Get event name from first market or event_ticker
        const eventName = eventMarkets[0]?.event_title || eventTicker;

        // Prices are in cents (0-100), so divide by 100 to get decimal probability
        const outcomes = eventMarkets
          .filter((m: any) => m.yes_sub_title !== "Tie") // Exclude "Tie" outcomes
          .map((m: any) => ({
            name: m.yes_sub_title || m.title,
            probability: (m.last_price || m.yes_bid || 0) / 100,
          }));

        // Sort by probability descending
        outcomes.sort((a: any, b: any) => b.probability - a.probability);

        results[eventTicker] = { name: eventName, outcomes };
      }
    } catch (e) {
      // Silently skip series that don't exist or have no markets
    }
  }

  // Output results
  console.log("=".repeat(60));
  console.log("KALSHI GRAMMY ODDS");
  console.log("=".repeat(60));

  for (const [ticker, data] of Object.entries(results)) {
    console.log(`\n${data.name}`);
    console.log("-".repeat(50));
    for (const outcome of data.outcomes) {
      const pct = (outcome.probability * 100).toFixed(1).padStart(5);
      console.log(`  ${pct}%  ${outcome.name}`);
    }
  }

  // Output as JSON for seeding
  console.log("\n\n" + "=".repeat(60));
  console.log("JSON OUTPUT (for seeding):");
  console.log("=".repeat(60));
  console.log(JSON.stringify(results, null, 2));
}

async function discoverAllGrammySeries(): Promise<string[]> {
  console.log("Discovering all Grammy series on Kalshi...\n");

  try {
    const seriesData = await kalshiRequest("/series?limit=500");
    const allSeries = seriesData.series || [];

    // Filter for Grammy-related series
    const grammySeries = allSeries.filter((s: any) =>
      s.ticker?.toLowerCase().includes("gram") &&
      !s.ticker?.toLowerCase().includes("instagram") &&
      !s.ticker?.toLowerCase().includes("program")
    );

    console.log(`Found ${grammySeries.length} Grammy series:\n`);
    for (const s of grammySeries) {
      console.log(`  ${s.ticker}: ${s.title}`);
    }

    return grammySeries.map((s: any) => s.ticker);
  } catch (e) {
    console.error("Failed to discover series:", e);
    return [];
  }
}

// Main
if (!KALSHI_API_KEY_ID) {
  console.error("Missing KALSHI_API_KEY_ID environment variable");
  process.exit(1);
}

// Discover all Grammy series first, then fetch odds
(async () => {
  const discoveredSeries = await discoverAllGrammySeries();
  console.log("\n");

  // Add discovered series to our list
  const allSeries = Array.from(new Set([...GRAMMY_SERIES, ...discoveredSeries]));

  // Override the constant for this run
  (GRAMMY_SERIES as any).length = 0;
  (GRAMMY_SERIES as any).push(...allSeries);

  await fetchGrammyMarketsBySeries();
})();
