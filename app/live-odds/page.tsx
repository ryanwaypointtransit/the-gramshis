"use client";

import { useState, useEffect, useRef } from "react";

interface Bettor {
  name: string;
  shares: number;
}

interface Outcome {
  id: number;
  name: string;
  price: number;
  shares: number;
  bettors: Bettor[];
}

interface Market {
  id: number;
  name: string;
  totalShares: number;
  outcomes: Outcome[];
}

interface LeaderboardEntry {
  id: number;
  name: string;
  displayName: string;
  totalValue: number;
}

interface LiveData {
  markets: Market[];
  leaderboard: LeaderboardEntry[];
  timestamp: number;
}

export default function LiveOddsPage() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previousPrices = useRef<Record<string, number>>({});
  const [priceChanges, setPriceChanges] = useState<Record<string, "up" | "down" | null>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/live");
        if (!res.ok) throw new Error("Failed to fetch");
        const newData: LiveData = await res.json();

        // Track price changes
        const changes: Record<string, "up" | "down" | null> = {};
        for (const market of newData.markets) {
          for (const outcome of market.outcomes) {
            const key = `${market.id}-${outcome.id}`;
            const prevPrice = previousPrices.current[key];
            if (prevPrice !== undefined) {
              if (outcome.price > prevPrice + 0.001) {
                changes[key] = "up";
              } else if (outcome.price < prevPrice - 0.001) {
                changes[key] = "down";
              }
            }
            previousPrices.current[key] = outcome.price;
          }
        }

        setPriceChanges(changes);
        setData(newData);
        setError(null);

        // Clear price changes after animation
        setTimeout(() => setPriceChanges({}), 500);
      } catch {
        setError("Failed to load data");
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="live-display flex items-center justify-center">
        <p className="text-red-500 text-2xl">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="live-display flex items-center justify-center">
        <p className="text-white text-2xl animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="live-display min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-grammy-gold mb-1">
          🏆 The Gramshis
        </h1>
        <p className="text-lg text-gray-400">Live Grammy Predictions</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Markets */}
        <div className="xl:col-span-3">
          {data.markets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-2xl">No active markets</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.markets.map((market) => (
                <MarketDisplay
                  key={market.id}
                  market={market}
                  priceChanges={priceChanges}
                />
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="xl:col-span-1">
          <div className="bg-gray-800/70 backdrop-blur rounded-xl p-5 sticky top-6 border border-gray-700">
            <h2 className="text-xl font-bold text-grammy-gold mb-4 flex items-center gap-2">
              <span>👑</span> Leaderboard
            </h2>
            <div className="space-y-2">
              {data.leaderboard.slice(0, 10).map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg transition-all ${
                    index === 0
                      ? "bg-gradient-to-r from-grammy-gold/30 to-yellow-600/20 border border-grammy-gold/50"
                      : index < 3
                        ? "bg-gray-700/50"
                        : "bg-gray-800/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-sm w-5 ${
                        index === 0
                          ? "text-grammy-gold"
                          : index === 1
                            ? "text-gray-300"
                            : index === 2
                              ? "text-orange-400"
                              : "text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-white font-medium text-sm truncate max-w-[100px]">
                      {entry.displayName}
                    </span>
                  </div>
                  <span className="text-grammy-gold font-bold text-sm">
                    ${entry.totalValue.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 text-gray-500 text-xs">
        Auto-refreshing • {new Date(data.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

function MarketDisplay({
  market,
  priceChanges,
}: {
  market: Market;
  priceChanges: Record<string, "up" | "down" | null>;
}) {
  // Sort outcomes by price
  const sortedOutcomes = [...market.outcomes].sort((a, b) => b.price - a.price);
  const displayOutcomes = sortedOutcomes.slice(0, 5);

  return (
    <div className="bg-gray-800/70 backdrop-blur rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-base font-bold text-white truncate flex-1 mr-2">
          {market.name}
        </h3>
        <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded">
          {market.totalShares.toFixed(0)} shares
        </span>
      </div>
      
      <div className="space-y-2">
        {displayOutcomes.map((outcome, index) => {
          const changeKey = `${market.id}-${outcome.id}`;
          const change = priceChanges[changeKey];
          const isLeader = index === 0;

          return (
            <div
              key={outcome.id}
              className={`rounded-lg transition-all ${
                change === "up"
                  ? "bg-green-500/20"
                  : change === "down"
                    ? "bg-red-500/20"
                    : isLeader
                      ? "bg-grammy-gold/10"
                      : "bg-gray-700/30"
              }`}
            >
              <div className="flex items-center justify-between p-2">
                <div className="flex-1 min-w-0 mr-2">
                  <span
                    className={`text-sm truncate block ${
                      isLeader ? "text-grammy-gold font-semibold" : "text-gray-200"
                    }`}
                  >
                    {outcome.name}
                  </span>
                  {/* Bettors */}
                  {outcome.bettors.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {outcome.bettors.slice(0, 3).map((bettor, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-gray-600/50 text-gray-300 px-1.5 py-0.5 rounded truncate max-w-[60px]"
                          title={`${bettor.name}: ${bettor.shares.toFixed(0)} shares`}
                        >
                          {bettor.name}
                        </span>
                      ))}
                      {outcome.bettors.length > 3 && (
                        <span className="text-[10px] text-gray-500">
                          +{outcome.bettors.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={`text-lg font-bold ${
                      isLeader ? "text-grammy-gold" : "text-white"
                    }`}
                  >
                    {(outcome.price * 100).toFixed(1)}
                    <span className="text-xs text-gray-400">¢</span>
                  </span>
                  <div className="text-[10px] text-gray-500">
                    {outcome.shares.toFixed(0)} sh
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {market.outcomes.length > 5 && (
          <p className="text-gray-500 text-xs text-center py-1">
            +{market.outcomes.length - 5} more nominees
          </p>
        )}
      </div>
    </div>
  );
}
