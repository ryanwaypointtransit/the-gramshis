"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminFetch } from "../AdminContext";
import NavBar from "@/components/NavBar";

// The 15 Grammy markets we're using
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

interface Market {
  id: number;
  name: string;
  status: "draft" | "open" | "paused" | "resolved";
}

export default function AdminMarketsPage() {
  const params = useParams();
  const adminKey = params.adminKey as string;
  const adminFetch = useAdminFetch();
  
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadMarkets = useCallback(async () => {
    try {
      setError("");
      const res = await adminFetch("/api/admin/markets");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to fetch markets");
        setMarkets([]);
        return;
      }
      
      // Filter to only show the 15 Grammy markets
      const filteredMarkets = (data.markets || []).filter((m: Market) =>
        GRAMMY_MARKETS_15.some((name) => 
          m.name.toLowerCase() === name.toLowerCase()
        )
      );
      
      // Sort by the order in GRAMMY_MARKETS_15
      filteredMarkets.sort((a: Market, b: Market) => {
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
      setError("Failed to connect to server");
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const updateMarketStatus = async (marketId: number, newStatus: string) => {
    setActionLoading(`${marketId}-${newStatus}`);
    setError("");
    setSuccessMessage("");

    try {
      const res = await adminFetch(`/api/admin/markets/${marketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || `Failed to ${newStatus} market`);
      } else {
        await loadMarkets();
      }
    } catch {
      setError(`Failed to ${newStatus} market`);
    } finally {
      setActionLoading(null);
    }
  };

  const bulkUpdateStatus = async (fromStatus: string, toStatus: string, label: string) => {
    const targetMarkets = markets.filter((m) => m.status === fromStatus);
    if (targetMarkets.length === 0) {
      setError(`No ${fromStatus} markets to ${label.toLowerCase()}`);
      return;
    }

    if (!confirm(`Are you sure you want to ${label.toLowerCase()} ${targetMarkets.length} markets?`)) {
      return;
    }

    setActionLoading(`bulk-${toStatus}`);
    setError("");
    setSuccessMessage("");

    let successCount = 0;
    let failCount = 0;

    for (const market of targetMarkets) {
      try {
        const res = await adminFetch(`/api/admin/markets/${market.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: toStatus }),
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

    setActionLoading(null);
    
    if (failCount === 0) {
      setSuccessMessage(`Successfully updated ${successCount} markets!`);
    } else {
      setError(`Updated ${successCount} markets, but ${failCount} failed.`);
    }
    
    await loadMarkets();
  };

  const draftCount = markets.filter((m) => m.status === "draft").length;
  const openCount = markets.filter((m) => m.status === "open").length;
  const pausedCount = markets.filter((m) => m.status === "paused").length;
  const resolvedCount = markets.filter((m) => m.status === "resolved").length;

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

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/control/${adminKey}`} className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Manage Markets</h1>
          <p className="text-sm text-gray-500">Control the 15 Grammy Award Categories</p>
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-yellow-600">{draftCount}</p>
            <p className="text-xs text-gray-500">Draft</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-green-600">{openCount}</p>
            <p className="text-xs text-gray-500">Open</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-orange-600">{pausedCount}</p>
            <p className="text-xs text-gray-500">Paused</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-gray-600">{resolvedCount}</p>
            <p className="text-xs text-gray-500">Resolved</p>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Bulk Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => bulkUpdateStatus("draft", "open", "Start")}
              disabled={actionLoading !== null || draftCount === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {actionLoading === "bulk-open" ? "Starting..." : `Start All Draft (${draftCount})`}
            </button>
            <button
              onClick={() => bulkUpdateStatus("open", "paused", "Pause")}
              disabled={actionLoading !== null || openCount === 0}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {actionLoading === "bulk-paused" ? "Pausing..." : `Pause All Open (${openCount})`}
            </button>
            <button
              onClick={() => bulkUpdateStatus("paused", "open", "Resume")}
              disabled={actionLoading !== null || pausedCount === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {actionLoading === "bulk-open" ? "Resuming..." : `Resume All Paused (${pausedCount})`}
            </button>
          </div>
        </div>

        {/* Markets List */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">All Markets ({markets.length}/15)</h2>
          
          {markets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No markets found in database.</p>
              <p className="text-gray-400 text-sm">
                Run the seed script to create markets: <code className="bg-gray-100 px-2 py-1 rounded">npx ts-node scripts/seed-markets.ts</code>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {markets.map((market) => (
                <div
                  key={market.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        market.status === "draft"
                          ? "bg-yellow-500"
                          : market.status === "open"
                            ? "bg-green-500"
                            : market.status === "paused"
                              ? "bg-orange-500"
                              : "bg-gray-400"
                      }`}
                    />
                    <span className="font-medium text-gray-900">{market.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
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
                    
                    {/* Action buttons based on current status */}
                    {market.status === "draft" && (
                      <button
                        onClick={() => updateMarketStatus(market.id, "open")}
                        disabled={actionLoading !== null}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionLoading === `${market.id}-open` ? "..." : "Start"}
                      </button>
                    )}
                    
                    {market.status === "open" && (
                      <button
                        onClick={() => updateMarketStatus(market.id, "paused")}
                        disabled={actionLoading !== null}
                        className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 disabled:opacity-50"
                      >
                        {actionLoading === `${market.id}-paused` ? "..." : "Pause"}
                      </button>
                    )}
                    
                    {market.status === "paused" && (
                      <button
                        onClick={() => updateMarketStatus(market.id, "open")}
                        disabled={actionLoading !== null}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading === `${market.id}-open` ? "..." : "Resume"}
                      </button>
                    )}
                    
                    <Link
                      href={`/control/${adminKey}/markets/${market.id}`}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2"
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {markets.length > 0 && markets.length < 15 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              <strong>Missing {15 - markets.length} markets:</strong>{" "}
              {GRAMMY_MARKETS_15.filter(
                (name) => !markets.some((m) => m.name.toLowerCase() === name.toLowerCase())
              ).join(", ")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
