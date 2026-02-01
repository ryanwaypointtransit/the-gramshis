"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Outcome {
  id: number;
  name: string;
  price: number;
  userShares: number;
}

interface TradeFormProps {
  marketId: number;
  outcomes: Outcome[];
  userBalance: number;
  isOpen: boolean;
}

interface Quote {
  outcomeId: number;
  outcomeName: string;
  action: string;
  shares: number;
  totalCost: number;
  avgPricePerShare: number;
  currentPrice: number;
  newPrice: number;
  priceImpact: number;
}

export default function TradeForm({ marketId, outcomes, userBalance, isOpen }: TradeFormProps) {
  const router = useRouter();
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedOutcomeData = outcomes.find((o) => o.id === selectedOutcome);

  const fetchQuote = useCallback(async () => {
    if (!selectedOutcome || !shares || parseFloat(shares) <= 0) {
      setQuote(null);
      return;
    }

    setQuoteLoading(true);
    try {
      const params = new URLSearchParams({
        outcomeId: selectedOutcome.toString(),
        shares,
        action,
      });
      const res = await fetch(`/api/markets/${marketId}/quote?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to get quote");
        setQuote(null);
      } else {
        setQuote(data.quote);
        setError("");
      }
    } catch {
      setError("Failed to get quote");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [selectedOutcome, shares, action, marketId]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 300);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const handleTrade = async () => {
    if (!selectedOutcome || !shares || parseFloat(shares) <= 0) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/markets/${marketId}/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeId: selectedOutcome,
          shares: parseFloat(shares),
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Trade failed");
      } else {
        // Success! Reset form and refresh page
        setShares("");
        setSelectedOutcome(null);
        setQuote(null);
        router.refresh();
      }
    } catch {
      setError("Trade failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="card bg-gray-50">
        <p className="text-gray-500 text-center">
          This market is not open for trading.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Trade</h3>

      {/* Action Toggle */}
      <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
        <button
          onClick={() => setAction("buy")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            action === "buy"
              ? "bg-white text-green-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setAction("sell")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            action === "sell"
              ? "bg-white text-red-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Outcome Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Outcome
        </label>
        <div className="space-y-2">
          {outcomes.map((outcome) => (
            <button
              key={outcome.id}
              onClick={() => setSelectedOutcome(outcome.id)}
              className={`w-full flex justify-between items-center p-3 rounded-lg border transition-colors ${
                selectedOutcome === outcome.id
                  ? "border-grammy-gold bg-grammy-gold/10"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="font-medium text-gray-900">{outcome.name}</span>
              <div className="text-right">
                <span className="font-mono text-lg">
                  {(outcome.price * 100).toFixed(1)}¢
                </span>
                {outcome.userShares > 0 && (
                  <p className="text-xs text-gray-500">
                    You own {outcome.userShares.toFixed(2)} shares
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Shares Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Shares
        </label>
        <input
          type="number"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="0"
          min="0"
          step="0.1"
          className="input text-lg"
        />
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span>Available: ${userBalance.toFixed(2)}</span>
          {action === "sell" && selectedOutcomeData && (
            <button
              onClick={() => setShares(selectedOutcomeData.userShares.toString())}
              className="text-grammy-gold hover:underline"
            >
              Sell All ({selectedOutcomeData.userShares.toFixed(2)})
            </button>
          )}
        </div>
      </div>

      {/* Quote Preview */}
      {quoteLoading && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-center">Calculating...</p>
        </div>
      )}

      {quote && !quoteLoading && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Cost</span>
            <span className="font-semibold text-gray-900">
              ${quote.totalCost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Avg Price per Share</span>
            <span className="text-gray-900">
              {(quote.avgPricePerShare * 100).toFixed(2)}¢
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Price Impact</span>
            <span
              className={
                quote.priceImpact > 0 ? "text-green-600" : "text-red-600"
              }
            >
              {(quote.currentPrice * 100).toFixed(1)}¢ → {(quote.newPrice * 100).toFixed(1)}¢
            </span>
          </div>
          {action === "buy" && (
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-600">Max Payout</span>
              <span className="font-semibold text-green-600">
                ${parseFloat(shares).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleTrade}
        disabled={loading || !selectedOutcome || !shares || parseFloat(shares) <= 0}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          action === "buy"
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-red-600 hover:bg-red-700 text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading
          ? "Processing..."
          : quote
            ? `${action === "buy" ? "Buy" : "Sell"} for $${quote.totalCost.toFixed(2)}`
            : `${action === "buy" ? "Buy" : "Sell"} Shares`}
      </button>
    </div>
  );
}
