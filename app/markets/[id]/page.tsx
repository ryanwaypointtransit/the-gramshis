import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { sql, Market, Outcome, Position } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";
import NavBar from "@/components/NavBar";
import TradeForm from "@/components/markets/TradeForm";

export const dynamic = "force-dynamic";

interface OutcomeWithPrice extends Outcome {
  price: number;
  userShares: number;
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const { id } = await params;
  const marketId = parseInt(id, 10);

  if (isNaN(marketId)) {
    notFound();
  }

  const marketResult = await sql`SELECT * FROM markets WHERE id = ${marketId}`;
  const market = marketResult[0] as Market | undefined;

  if (!market || market.status === "draft") {
    notFound();
  }

  const outcomesResult = await sql`
    SELECT * FROM outcomes WHERE market_id = ${marketId} ORDER BY display_order
  `;
  const outcomes = outcomesResult as Outcome[];

  const shares = outcomes.map((o) => Number(o.shares_outstanding));
  const prices = calculatePrices(shares, Number(market.liquidity_param));

  // Get user positions (using subquery to get outcome IDs)
  const positionsResult = await sql`
    SELECT * FROM positions 
    WHERE user_id = ${user.id} 
    AND outcome_id IN (SELECT id FROM outcomes WHERE market_id = ${marketId})
  `;
  const positions = positionsResult as Position[];

  const userPositions: Record<number, number> = positions.reduce((acc, p) => {
    acc[p.outcome_id] = Number(p.shares);
    return acc;
  }, {} as Record<number, number>);

  const outcomesWithPrices: OutcomeWithPrice[] = outcomes.map((o, i) => ({
    ...o,
    shares_outstanding: Number(o.shares_outstanding),
    price: prices[i],
    userShares: userPositions[o.id] || 0,
  }));

  // Sort by price for display (highest first)
  const sortedOutcomes = [...outcomesWithPrices].sort((a, b) => b.price - a.price);

  // Find winning outcome for resolved markets
  const winningOutcome = market.winning_outcome_id
    ? outcomes.find((o) => o.id === market.winning_outcome_id)
    : null;

  const userBalance = Number(user.balance);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userName={user.display_name}
        balance={userBalance}
        isAdmin={user.is_admin === 1}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/markets"
          className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block"
        >
          ← Back to Markets
        </Link>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Market Info */}
          <div className="flex-1">
            <div className="card mb-6">
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-2xl font-bold text-gray-900">{market.name}</h1>
                <span
                  className={`text-sm px-3 py-1 rounded-full ${
                    market.status === "open"
                      ? "bg-green-100 text-green-800"
                      : market.status === "paused"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {market.status === "open"
                    ? "Trading Open"
                    : market.status === "paused"
                      ? "Trading Paused"
                      : "Resolved"}
                </span>
              </div>

              {market.description && (
                <p className="text-gray-600 mb-4">{market.description}</p>
              )}

              {winningOutcome && (
                <div className="p-4 bg-grammy-gold/20 border border-grammy-gold rounded-lg mb-4">
                  <p className="text-sm text-gray-600">Winner</p>
                  <p className="text-xl font-bold text-gray-900">
                    🏆 {winningOutcome.name}
                  </p>
                </div>
              )}
            </div>

            {/* Outcomes List */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Outcomes</h2>
              <div className="space-y-3">
                {sortedOutcomes.map((outcome, index) => (
                  <div
                    key={outcome.id}
                    className={`flex items-center p-4 rounded-lg border ${
                      winningOutcome?.id === outcome.id
                        ? "border-grammy-gold bg-grammy-gold/10"
                        : "border-gray-200"
                    }`}
                  >
                    <span className="text-gray-400 w-6 text-sm">{index + 1}</span>
                    <div className="flex-1 ml-2">
                      <p
                        className={`font-medium ${
                          winningOutcome?.id === outcome.id
                            ? "text-grammy-gold"
                            : "text-gray-900"
                        }`}
                      >
                        {outcome.name}
                        {winningOutcome?.id === outcome.id && " ✓"}
                      </p>
                      {outcome.userShares > 0 && (
                        <p className="text-sm text-gray-500">
                          You own {outcome.userShares.toFixed(2)} shares
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-mono font-bold text-gray-900">
                        {(outcome.price * 100).toFixed(1)}
                        <span className="text-sm font-normal text-gray-500">¢</span>
                      </p>
                      <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                        <div
                          className="h-2 bg-grammy-gold rounded-full"
                          style={{ width: `${outcome.price * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trade Form */}
          <div className="lg:w-96">
            <TradeForm
              marketId={market.id}
              outcomes={outcomesWithPrices}
              userBalance={userBalance}
              isOpen={market.status === "open"}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
