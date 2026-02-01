import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { sql, Market, Outcome } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";
import NavBar from "@/components/NavBar";

export const dynamic = "force-dynamic";

interface MarketWithOutcomes extends Market {
  outcomes: (Outcome & { price: number })[];
}

export default async function MarketsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const marketsResult = await sql`
    SELECT * FROM markets WHERE status != 'draft' ORDER BY
    CASE status
      WHEN 'open' THEN 1
      WHEN 'paused' THEN 2
      WHEN 'resolved' THEN 3
    END,
    created_at DESC
  `;
  const markets = marketsResult as Market[];

  const marketsWithOutcomes: MarketWithOutcomes[] = [];
  for (const market of markets) {
    const outcomesResult = await sql`
      SELECT * FROM outcomes WHERE market_id = ${market.id} ORDER BY display_order
    `;
    const outcomes = outcomesResult as Outcome[];

    const shares = outcomes.map((o) => Number(o.shares_outstanding));
    const prices = calculatePrices(shares, Number(market.liquidity_param));

    marketsWithOutcomes.push({
      ...market,
      liquidity_param: Number(market.liquidity_param),
      outcomes: outcomes.map((o, i) => ({
        ...o,
        shares_outstanding: Number(o.shares_outstanding),
        price: prices[i],
      })),
    });
  }

  const openMarkets = marketsWithOutcomes.filter((m) => m.status === "open");
  const pausedMarkets = marketsWithOutcomes.filter((m) => m.status === "paused");
  const resolvedMarkets = marketsWithOutcomes.filter((m) => m.status === "resolved");

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userName={user.display_name}
        balance={Number(user.balance)}
        isAdmin={user.is_admin === 1}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Markets</h1>

        {marketsWithOutcomes.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500 text-lg">No markets available yet.</p>
            <p className="text-gray-400 mt-2">Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Open Markets */}
            {openMarkets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Open Markets
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {openMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </div>
            )}

            {/* Paused Markets */}
            {pausedMarkets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  Paused Markets
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {pausedMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </div>
            )}

            {/* Resolved Markets */}
            {resolvedMarkets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                  Resolved Markets
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {resolvedMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MarketCard({ market }: { market: MarketWithOutcomes }) {
  // Find the leading outcome (highest price)
  const leadingOutcome = market.outcomes.reduce((max, o) =>
    o.price > max.price ? o : max
  );

  // Find winning outcome for resolved markets
  const winningOutcome = market.winning_outcome_id
    ? market.outcomes.find((o) => o.id === market.winning_outcome_id)
    : null;

  return (
    <Link href={`/markets/${market.id}`} className="card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-900">{market.name}</h3>
        <span
          className={`text-xs px-2 py-1 rounded ${
            market.status === "open"
              ? "bg-green-100 text-green-800"
              : market.status === "paused"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-800"
          }`}
        >
          {market.status}
        </span>
      </div>

      {market.description && (
        <p className="text-sm text-gray-500 mb-3">{market.description}</p>
      )}

      <div className="space-y-2">
        {market.outcomes.slice(0, 4).map((outcome) => (
          <div key={outcome.id} className="flex justify-between items-center">
            <span
              className={`text-sm ${
                winningOutcome?.id === outcome.id
                  ? "text-grammy-gold font-semibold"
                  : "text-gray-700"
              }`}
            >
              {outcome.name}
              {winningOutcome?.id === outcome.id && " ✓"}
            </span>
            <span
              className={`font-mono text-sm ${
                outcome.id === leadingOutcome.id && market.status === "open"
                  ? "text-grammy-gold font-semibold"
                  : "text-gray-600"
              }`}
            >
              {(outcome.price * 100).toFixed(1)}¢
            </span>
          </div>
        ))}
        {market.outcomes.length > 4 && (
          <p className="text-xs text-gray-400">
            +{market.outcomes.length - 4} more outcomes
          </p>
        )}
      </div>
    </Link>
  );
}
