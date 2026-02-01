"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminFetch } from "../AdminContext";
import NavBar from "@/components/NavBar";

// The 15 Grammy markets we're using (with Kalshi odds available)
const GRAMMY_MARKETS_15 = [
  "Song of the Year",
  "Best New Artist",
  "Album of the Year",
  "Record of the Year",
  "Best Pop Duo/Group Performance",
  "Best Pop Vocal Album",
  "Best Rap Album",
  "Best Rap Song",
  "Best Alternative Music Performance",
  "Best Dance/Electronic Album",
  "Best Dance/Electronic Recording",
  "Best Dance Pop Recording",
  "Best Country Solo Performance",
  "Best Contemporary Country Album",
  "Best Remixed Recording",
];

interface Outcome {
  id: number;
  name: string;
  shares_outstanding: number;
  price?: number;
}

interface Market {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "open" | "paused" | "resolved";
  liquidity_param: number;
  outcomes?: Outcome[];
}

interface MarketWithOutcomes extends Market {
  outcomes: (Outcome & { price: number })[];
}

export default function AdminMarketsPage() {
  const params = useParams();
  const adminKey = params.adminKey as string;
  const adminFetch = useAdminFetch();
  
  const [markets, setMarkets] = useState<MarketWithOutcomes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const loadMarkets = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/markets");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to fetch markets");
        return;
      }
      
      // For each market, fetch its details to get outcomes with prices
      const marketsWithOutcomes: MarketWithOutcomes[] = [];
      for (const market of data.markets || []) {
        const detailRes = await adminFetch(`/api/admin/markets/${market.id}`);
        const detailData = await detailRes.json();
        if (detailRes.ok && detailData.market) {
          marketsWithOutcomes.push(detailData.market);
        }
      }
      
      // Filter to only show the 15 Grammy markets
      const filteredMarkets = marketsWithOutcomes.filter((m) =>
        GRAMMY_MARKETS_15.some((name) => 
          m.name.toLowerCase() === name.toLowerCase()
        )
      );
      
      // Sort by the order in GRAMMY_MARKETS_15
      filteredMarkets.sort((a, b) => {
        const indexA = GRAMMY_MARKETS_15.findIndex(
          (name) => name.toLowerCase() === a.name.toLowerCase()
        );
        const indexB = GRAMMY_MARKETS_15.findIndex(
          (name) => name.toLowerCase() === b.name.toLowerCase()
        );
        return indexA - indexB;
      });
      
      setMarkets(filteredMarkets);
    } catch (err) {
      setError("Failed to fetch markets");
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const startAllDraftMarkets = async () => {
    const drafts = markets.filter((m) => m.status === "draft");
    if (drafts.length === 0) {
      setError("No draft markets to start");
      return;
    }

    if (!confirm(`Are you sure you want to open ${drafts.length} draft markets for trading?`)) {
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccessMessage("");

    let successCount = 0;
    let failCount = 0;

    for (const market of drafts) {
      try {
        const res = await adminFetch(`/api/admin/markets/${market.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "open" }),
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setActionLoading(false);
    
    if (failCount === 0) {
      setSuccessMessage(`Successfully opened ${successCount} markets for trading!`);
    } else {
      setError(`Opened ${successCount} markets, but ${failCount} failed.`);
    }
    
    // Reload markets
    await loadMarkets();
  };

  const draftMarkets = markets.filter((m) => m.status === "draft");
  const openMarkets = markets.filter((m) => m.status === "open");
  const pausedMarkets = markets.filter((m) => m.status === "paused");
  const resolvedMarkets = markets.filter((m) => m.status === "resolved");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading markets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar userName="Admin" balance={0} isAdmin={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link href={`/control/${adminKey}`} className="text-gray-500 hover:text-gray-700 text-sm">
              ← Back to Admin
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Manage Markets</h1>
            <p className="text-sm text-gray-500 mt-1">15 Grammy Award Categories</p>
          </div>
          <div className="flex gap-3">
            {draftMarkets.length > 0 && (
              <button
                onClick={startAllDraftMarkets}
                disabled={actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {actionLoading ? "Starting..." : `Start All ${draftMarkets.length} Draft Markets`}
              </button>
            )}
            <Link href={`/control/${adminKey}/markets/new`} className="btn-primary">
              + Create Market
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600">{successMessage}</p>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-2xl font-bold text-yellow-600">{draftMarkets.length}</p>
            <p className="text-sm text-gray-500">Draft</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{openMarkets.length}</p>
            <p className="text-sm text-gray-500">Open</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-orange-600">{pausedMarkets.length}</p>
            <p className="text-sm text-gray-500">Paused</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-600">{resolvedMarkets.length}</p>
            <p className="text-sm text-gray-500">Resolved</p>
          </div>
        </div>

        {/* Draft Markets */}
        {draftMarkets.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Draft Markets ({draftMarkets.length})
              </h2>
            </div>
            <div className="space-y-4">
              {draftMarkets.map((market) => (
                <MarketRow key={market.id} market={market} adminKey={adminKey} />
              ))}
            </div>
          </div>
        )}

        {/* Open Markets */}
        {openMarkets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Open Markets ({openMarkets.length})
            </h2>
            <div className="space-y-4">
              {openMarkets.map((market) => (
                <MarketRow key={market.id} market={market} adminKey={adminKey} />
              ))}
            </div>
          </div>
        )}

        {/* Paused Markets */}
        {pausedMarkets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
              Paused Markets ({pausedMarkets.length})
            </h2>
            <div className="space-y-4">
              {pausedMarkets.map((market) => (
                <MarketRow key={market.id} market={market} adminKey={adminKey} />
              ))}
            </div>
          </div>
        )}

        {/* Resolved Markets */}
        {resolvedMarkets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
              Resolved Markets ({resolvedMarkets.length})
            </h2>
            <div className="space-y-4">
              {resolvedMarkets.map((market) => (
                <MarketRow key={market.id} market={market} adminKey={adminKey} />
              ))}
            </div>
          </div>
        )}

        {markets.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No Grammy markets found.</p>
            <p className="text-gray-400 text-sm mb-6">
              Expected 15 markets: {GRAMMY_MARKETS_15.join(", ")}
            </p>
            <Link href={`/control/${adminKey}/markets/new`} className="btn-primary">
              Create Market
            </Link>
          </div>
        )}

        {markets.length > 0 && markets.length < 15 && (
          <div className="card bg-yellow-50 border-yellow-200 mt-6">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> Only {markets.length} of 15 Grammy markets found.
              Missing: {GRAMMY_MARKETS_15.filter(
                (name) => !markets.some((m) => m.name.toLowerCase() === name.toLowerCase())
              ).join(", ")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function MarketRow({ market, adminKey }: { market: MarketWithOutcomes; adminKey: string }) {
  const leadingOutcome = market.outcomes?.reduce(
    (max, o) => (o.price > max.price ? o : max),
    market.outcomes[0]
  );

  return (
    <Link
      href={`/control/${adminKey}/markets/${market.id}`}
      className="card hover:shadow-md transition-shadow block"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900">{market.name}</h3>
        <span
          className={`text-xs px-2 py-1 rounded ${
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
      <div className="flex justify-between text-sm text-gray-500">
        <span>{market.outcomes?.length || 0} nominees</span>
        {leadingOutcome && (
          <span>
            Leading: {leadingOutcome.name.split(" - ")[0]} ({(leadingOutcome.price * 100).toFixed(1)}%)
          </span>
        )}
      </div>
    </Link>
  );
}
