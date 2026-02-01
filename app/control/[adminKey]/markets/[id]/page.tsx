"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAdminFetch } from "../../AdminContext";

interface Outcome {
  id: number;
  name: string;
  shares_outstanding: number;
  price: number;
}

interface Market {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "open" | "paused" | "resolved";
  liquidity_param: number;
  winning_outcome_id: number | null;
  outcomes: Outcome[];
}

export default function AdminMarketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const adminKey = params.adminKey as string;
  const marketId = params.id as string;
  const adminFetch = useAdminFetch();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Odds setting state
  const [odds, setOdds] = useState<Record<number, string>>({});

  const fetchMarket = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/markets/${marketId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch market");
        return;
      }

      setMarket(data.market);

      // Initialize odds from current prices
      const initialOdds: Record<number, string> = {};
      for (const outcome of data.market.outcomes) {
        initialOdds[outcome.id] = (outcome.price * 100).toFixed(1);
      }
      setOdds(initialOdds);
    } catch {
      setError("Failed to fetch market");
    } finally {
      setLoading(false);
    }
  }, [marketId, adminFetch]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  const updateStatus = async (newStatus: string) => {
    setActionLoading(true);
    setError("");

    try {
      const res = await adminFetch(`/api/admin/markets/${marketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update status");
      } else {
        await fetchMarket();
      }
    } catch {
      setError("Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const setInitialOdds = async () => {
    setActionLoading(true);
    setError("");

    try {
      const oddsArray = market!.outcomes.map((o) => ({
        outcomeId: o.id,
        price: parseFloat(odds[o.id]) / 100,
      }));

      const res = await adminFetch(`/api/admin/markets/${marketId}/set-odds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odds: oddsArray }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to set odds");
      } else {
        await fetchMarket();
      }
    } catch {
      setError("Failed to set odds");
    } finally {
      setActionLoading(false);
    }
  };

  const resolveMarket = async (winningOutcomeId: number) => {
    if (!confirm("Are you sure you want to resolve this market? This action cannot be undone.")) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const res = await adminFetch(`/api/admin/resolve/${marketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winningOutcomeId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to resolve market");
      } else {
        alert(`Market resolved! ${data.payoutCount} users received payouts totaling $${data.totalPayouts.toFixed(2)}`);
        await fetchMarket();
      }
    } catch {
      setError("Failed to resolve market");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">{error || "Market not found"}</p>
      </div>
    );
  }

  const oddsTotal = Object.values(odds).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href={`/control/${adminKey}/markets`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Markets
        </Link>

        <div className="flex justify-between items-start mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{market.name}</h1>
            {market.description && (
              <p className="text-gray-500 mt-1">{market.description}</p>
            )}
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full ${
              market.status === "draft"
                ? "bg-yellow-100 text-yellow-800"
                : market.status === "open"
                  ? "bg-green-100 text-green-800"
                  : market.status === "paused"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-gray-100 text-gray-800"
            }`}
          >
            {market.status}
          </span>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Status Actions */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Actions</h2>
          <div className="flex flex-wrap gap-3">
            {market.status === "draft" && (
              <button
                onClick={() => updateStatus("open")}
                disabled={actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Open Market
              </button>
            )}
            {market.status === "open" && (
              <>
                <button
                  onClick={() => updateStatus("paused")}
                  disabled={actionLoading}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  Pause Trading
                </button>
              </>
            )}
            {market.status === "paused" && (
              <button
                onClick={() => updateStatus("open")}
                disabled={actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Resume Trading
              </button>
            )}
          </div>
        </div>

        {/* Set Initial Odds (Draft only) */}
        {market.status === "draft" && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Set Initial Odds</h2>
            <p className="text-sm text-gray-500 mb-4">
              Enter the probability for each outcome (should sum to 100%).
            </p>
            <div className="space-y-3 mb-4">
              {market.outcomes.map((outcome) => (
                <div key={outcome.id} className="flex items-center gap-4">
                  <span className="flex-1 text-gray-900">{outcome.name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={odds[outcome.id] || ""}
                      onChange={(e) =>
                        setOdds({ ...odds, [outcome.id]: e.target.value })
                      }
                      className="w-24 input text-right"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  Math.abs(oddsTotal - 100) < 0.5 ? "text-green-600" : "text-red-600"
                }`}
              >
                Total: {oddsTotal.toFixed(1)}%
              </span>
              <button
                onClick={setInitialOdds}
                disabled={actionLoading || Math.abs(oddsTotal - 100) >= 0.5}
                className="btn-primary disabled:opacity-50"
              >
                {actionLoading ? "Setting..." : "Set Odds"}
              </button>
            </div>
          </div>
        )}

        {/* Current Odds */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Odds</h2>
          <div className="space-y-3">
            {[...market.outcomes]
              .sort((a, b) => b.price - a.price)
              .map((outcome) => (
                <div
                  key={outcome.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-900">{outcome.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-mono font-bold text-gray-900">
                      {(outcome.price * 100).toFixed(1)}%
                    </span>
                    {(market.status === "open" || market.status === "paused") && (
                      <button
                        onClick={() => resolveMarket(outcome.id)}
                        disabled={actionLoading}
                        className="text-sm px-3 py-1 bg-grammy-gold text-black rounded hover:bg-grammy-gold-light disabled:opacity-50"
                      >
                        Select Winner
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Resolved Info */}
        {market.status === "resolved" && market.winning_outcome_id && (
          <div className="card bg-grammy-gold/10 border-grammy-gold">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Market Resolved</h2>
            <p className="text-gray-700">
              Winner:{" "}
              <span className="font-bold">
                {market.outcomes.find((o) => o.id === market.winning_outcome_id)?.name}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
