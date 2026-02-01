import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { sql, Market, Outcome, User, Position } from "@/lib/db";
import { calculatePrices } from "@/lib/market-maker/lmsr";
import NavBar from "@/components/NavBar";

export const dynamic = "force-dynamic";

interface LeaderboardEntry {
  rank: number;
  id: number;
  name: string;
  displayName: string;
  balance: number;
  positionValue: number;
  totalValue: number;
  isCurrentUser: boolean;
}

export default async function LeaderboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const usersResult = await sql`SELECT * FROM users`;
  const users = usersResult as User[];

  const leaderboard: LeaderboardEntry[] = [];

  for (const u of users) {
    // Calculate position values
    const positionsResult = await sql`
      SELECT p.*, o.market_id
      FROM positions p
      JOIN outcomes o ON p.outcome_id = o.id
      WHERE p.user_id = ${u.id} AND p.shares > 0
    `;
    const positions = positionsResult as (Position & { market_id: number })[];

    let positionValue = 0;

    for (const pos of positions) {
      const marketResult = await sql`SELECT * FROM markets WHERE id = ${pos.market_id}`;
      const market = marketResult[0] as Market;
      if (market.status !== "open" && market.status !== "paused") continue;

      const outcomesResult = await sql`
        SELECT * FROM outcomes WHERE market_id = ${market.id} ORDER BY display_order
      `;
      const outcomes = outcomesResult as Outcome[];

      const sharesArray = outcomes.map((o) => Number(o.shares_outstanding));
      const prices = calculatePrices(sharesArray, Number(market.liquidity_param));

      const outcomeIndex = outcomes.findIndex((o) => o.id === pos.outcome_id);
      if (outcomeIndex !== -1) {
        positionValue += Number(pos.shares) * prices[outcomeIndex];
      }
    }

    leaderboard.push({
      rank: 0,
      id: u.id,
      name: u.name,
      displayName: u.display_name,
      balance: Number(u.balance),
      positionValue,
      totalValue: Number(u.balance) + positionValue,
      isCurrentUser: u.id === user.id,
    });
  }

  // Sort by total value
  leaderboard.sort((a, b) => b.totalValue - a.totalValue);

  // Add ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  const currentUserEntry = leaderboard.find((e) => e.isCurrentUser);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userName={user.display_name}
        balance={Number(user.balance)}
        isAdmin={user.is_admin === 1}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard</h1>

        {/* Current User's Position */}
        {currentUserEntry && currentUserEntry.rank > 3 && (
          <div className="card mb-6 bg-grammy-gold/10 border-grammy-gold">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-gray-600 w-12">
                #{currentUserEntry.rank}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {currentUserEntry.displayName} (You)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-grammy-gold">
                  ${currentUserEntry.totalValue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* 2nd Place */}
            <div className="card text-center pt-8 mt-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl">🥈</span>
              </div>
              <p className="font-semibold text-gray-900 truncate">
                {leaderboard[1].displayName}
              </p>
              <p className="text-xl font-bold text-gray-600">
                ${leaderboard[1].totalValue.toFixed(2)}
              </p>
              {leaderboard[1].isCurrentUser && (
                <span className="text-xs text-grammy-gold">You</span>
              )}
            </div>

            {/* 1st Place */}
            <div className="card text-center bg-grammy-gold/10 border-grammy-gold">
              <div className="w-20 h-20 bg-grammy-gold/20 rounded-full mx-auto mb-3 flex items-center justify-center">
                <span className="text-3xl">🏆</span>
              </div>
              <p className="font-bold text-gray-900 truncate text-lg">
                {leaderboard[0].displayName}
              </p>
              <p className="text-2xl font-bold text-grammy-gold">
                ${leaderboard[0].totalValue.toFixed(2)}
              </p>
              {leaderboard[0].isCurrentUser && (
                <span className="text-xs text-grammy-gold font-medium">You</span>
              )}
            </div>

            {/* 3rd Place */}
            <div className="card text-center pt-12 mt-8">
              <div className="w-14 h-14 bg-orange-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                <span className="text-xl">🥉</span>
              </div>
              <p className="font-semibold text-gray-900 truncate">
                {leaderboard[2].displayName}
              </p>
              <p className="text-lg font-bold text-gray-600">
                ${leaderboard[2].totalValue.toFixed(2)}
              </p>
              {leaderboard[2].isCurrentUser && (
                <span className="text-xs text-grammy-gold">You</span>
              )}
            </div>
          </div>
        )}

        {/* Full Leaderboard */}
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-500 w-16">Rank</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Player</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Cash</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Positions</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.id}
                  className={`border-b border-gray-100 ${
                    entry.isCurrentUser ? "bg-grammy-gold/10" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="py-3 px-2">
                    <span
                      className={`font-bold ${
                        entry.rank === 1
                          ? "text-grammy-gold"
                          : entry.rank === 2
                            ? "text-gray-400"
                            : entry.rank === 3
                              ? "text-orange-400"
                              : "text-gray-500"
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-medium text-gray-900">
                      {entry.displayName}
                      {entry.isCurrentUser && (
                        <span className="ml-2 text-xs text-grammy-gold">(You)</span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600">
                    ${entry.balance.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600">
                    ${entry.positionValue.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900">
                    ${entry.totalValue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
