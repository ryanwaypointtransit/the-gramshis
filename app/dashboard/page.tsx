import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb, Market, Outcome, Position } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";
import NavBar from "@/components/NavBar";

export const dynamic = "force-dynamic";

interface PositionWithDetails extends Position {
  outcomeName: string;
  marketId: number;
  marketName: string;
  marketStatus: string;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const db = getDb();

  // Get user's positions with market details
  const rawPositions = db
    .prepare(
      `SELECT p.*, o.name as outcome_name, o.market_id, m.name as market_name, m.status as market_status, m.liquidity_param
       FROM positions p
       JOIN outcomes o ON p.outcome_id = o.id
       JOIN markets m ON o.market_id = m.id
       WHERE p.user_id = ? AND p.shares > 0
       ORDER BY m.status = 'open' DESC, m.created_at DESC`
    )
    .all(user.id) as (Position & {
    outcome_name: string;
    market_id: number;
    market_name: string;
    market_status: string;
    liquidity_param: number;
  })[];

  const positions: PositionWithDetails[] = rawPositions.map((p) => {
    const outcomes = db
      .prepare("SELECT * FROM outcomes WHERE market_id = ? ORDER BY display_order")
      .all(p.market_id) as Outcome[];

    const shares = outcomes.map((o) => o.shares_outstanding);
    const prices = calculatePrices(shares, p.liquidity_param);
    const outcomeIndex = outcomes.findIndex((o) => o.id === p.outcome_id);
    const currentPrice = prices[outcomeIndex] || 0;
    const currentValue = p.shares * currentPrice;
    const costBasis = p.shares * p.avg_cost_basis;
    const profitLoss = currentValue - costBasis;

    return {
      ...p,
      outcomeName: p.outcome_name,
      marketId: p.market_id,
      marketName: p.market_name,
      marketStatus: p.market_status,
      currentPrice,
      currentValue,
      profitLoss,
    };
  });

  const totalPositionValue = positions
    .filter((p) => p.marketStatus === "open" || p.marketStatus === "paused")
    .reduce((sum, p) => sum + p.currentValue, 0);

  const totalProfitLoss = positions
    .filter((p) => p.marketStatus === "open" || p.marketStatus === "paused")
    .reduce((sum, p) => sum + p.profitLoss, 0);

  // Get recent transactions
  const transactions = db
    .prepare(
      `SELECT t.*, o.name as outcome_name, m.name as market_name
       FROM transactions t
       JOIN outcomes o ON t.outcome_id = o.id
       JOIN markets m ON o.market_id = m.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC
       LIMIT 10`
    )
    .all(user.id) as (Position & {
    type: string;
    price_per_share: number;
    total_cost: number;
    created_at: string;
    outcome_name: string;
    market_name: string;
  })[];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userName={user.display_name}
        balance={user.balance}
        isAdmin={user.is_admin === 1}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Cash Balance</p>
            <p className="text-3xl font-bold text-gray-900">
              ${user.balance.toFixed(2)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Position Value</p>
            <p className="text-3xl font-bold text-gray-900">
              ${totalPositionValue.toFixed(2)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Total Portfolio</p>
            <p className="text-3xl font-bold text-grammy-gold">
              ${(user.balance + totalPositionValue).toFixed(2)}
            </p>
            {totalProfitLoss !== 0 && (
              <p
                className={`text-sm ${totalProfitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {totalProfitLoss >= 0 ? "+" : ""}${totalProfitLoss.toFixed(2)} P/L
              </p>
            )}
          </div>
        </div>

        {/* Active Positions */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Positions</h2>
          {positions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">You don't have any positions yet.</p>
              <Link href="/markets" className="btn-primary">
                Browse Markets
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Market</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Outcome</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Shares</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Price</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Value</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <Link
                          href={`/markets/${p.marketId}`}
                          className="text-grammy-gold hover:underline"
                        >
                          {p.marketName}
                        </Link>
                        {p.marketStatus !== "open" && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-gray-200 rounded">
                            {p.marketStatus}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-gray-900">{p.outcomeName}</td>
                      <td className="py-3 px-2 text-right text-gray-900">{p.shares.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right text-gray-900">
                        {(p.currentPrice * 100).toFixed(1)}¢
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900">
                        ${p.currentValue.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-medium ${
                          p.profitLoss >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {p.profitLoss >= 0 ? "+" : ""}${p.profitLoss.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        t.type === "buy"
                          ? "bg-green-100 text-green-800"
                          : t.type === "sell"
                            ? "bg-red-100 text-red-800"
                            : "bg-grammy-gold text-black"
                      }`}
                    >
                      {t.type.toUpperCase()}
                    </span>
                    <span className="ml-2 text-gray-900">{t.outcome_name}</span>
                    <span className="ml-2 text-gray-500 text-sm">in {t.market_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-900">{t.shares.toFixed(2)} shares</p>
                    <p className="text-sm text-gray-500">${t.total_cost.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
