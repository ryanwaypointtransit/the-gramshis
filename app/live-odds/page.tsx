"use client";

import { useState, useEffect, useRef } from "react";

interface Outcome {
  id: number;
  name: string;
  price: number;
}

interface Market {
  id: number;
  name: string;
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
    const interval = setInterval(fetchData, 1500);

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
        <p className="text-white text-2xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="live-display p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-grammy-gold mb-2">
          🏆 The Gramshis
        </h1>
        <p className="text-xl text-gray-400">Grammy Awards Prediction Market</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Markets */}
        <div className="lg:col-span-3">
          {data.markets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-2xl">No active markets</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
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
        <div className="lg:col-span-1">
          <div className="bg-gray-800/50 rounded-xl p-6 sticky top-8">
            <h2 className="text-2xl font-bold text-grammy-gold mb-4">
              Leaderboard
            </h2>
            <div className="space-y-3">
              {data.leaderboard.slice(0, 10).map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0
                      ? "bg-grammy-gold/20"
                      : index < 3
                        ? "bg-gray-700/50"
                        : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold text-lg w-6 ${
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
                    <span className="text-white font-medium truncate max-w-[120px]">
                      {entry.displayName}
                    </span>
                  </div>
                  <span className="text-grammy-gold font-bold live-price">
                    ${entry.totalValue.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 text-gray-500 text-sm">
        Last updated: {new Date(data.timestamp).toLocaleTimeString()}
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
  const displayOutcomes = sortedOutcomes.slice(0, 6);

  return (
    <div className="bg-gray-800/50 rounded-xl p-6">
      <h3 className="text-xl font-bold text-white mb-4 truncate">
        {market.name}
      </h3>
      <div className="space-y-3">
        {displayOutcomes.map((outcome, index) => {
          const changeKey = `${market.id}-${outcome.id}`;
          const change = priceChanges[changeKey];

          return (
            <div
              key={outcome.id}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                change === "up"
                  ? "price-flash-up"
                  : change === "down"
                    ? "price-flash-down"
                    : ""
              } ${index === 0 ? "bg-grammy-gold/20" : "bg-gray-700/30"}`}
            >
              <span
                className={`text-lg truncate max-w-[200px] ${
                  index === 0 ? "text-grammy-gold font-semibold" : "text-gray-200"
                }`}
              >
                {outcome.name}
              </span>
              <span
                className={`text-2xl font-bold live-price ${
                  index === 0 ? "text-grammy-gold" : "text-white"
                }`}
              >
                {(outcome.price * 100).toFixed(1)}
                <span className="text-sm text-gray-400">¢</span>
              </span>
            </div>
          );
        })}
        {market.outcomes.length > 6 && (
          <p className="text-gray-500 text-sm text-center">
            +{market.outcomes.length - 6} more
          </p>
        )}
      </div>
    </div>
  );
}
