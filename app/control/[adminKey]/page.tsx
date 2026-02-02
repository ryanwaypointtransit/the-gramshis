"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminFetch } from "./AdminContext";
import NavBar from "@/components/NavBar";

export default function AdminPage() {
  const params = useParams();
  const adminKey = params.adminKey as string;
  const adminFetch = useAdminFetch();
  
  const [stats, setStats] = useState({
    userCount: 0,
    tradeCount: 0,
    marketCounts: { draft: 0, open: 0, paused: 0, resolved: 0 }
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch users to get count
        const usersRes = await adminFetch("/api/admin/users");
        const usersData = await usersRes.json();
        
        // Fetch markets to get counts
        const marketsRes = await adminFetch("/api/admin/markets");
        const marketsData = await marketsRes.json();
        
        if (usersRes.ok && marketsRes.ok) {
          const marketCounts = {
            draft: marketsData.markets?.filter((m: any) => m.status === "draft").length || 0,
            open: marketsData.markets?.filter((m: any) => m.status === "open").length || 0,
            paused: marketsData.markets?.filter((m: any) => m.status === "paused").length || 0,
            resolved: marketsData.markets?.filter((m: any) => m.status === "resolved").length || 0,
          };
          
          setStats({
            userCount: usersData.users?.length || 0,
            tradeCount: 0, // We'd need a separate endpoint for this
            marketCounts
          });
        }
      } catch (error) {
        console.error("Failed to load admin data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [adminFetch]);

  const handleReset = async (action: string, confirmMessage: string) => {
    if (!confirm(confirmMessage)) return;
    
    setResetting(true);
    setResetMessage("");
    
    try {
      const res = await adminFetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setResetMessage(data.message);
        // Reload the page to refresh stats
        window.location.reload();
      } else {
        setResetMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setResetMessage("Failed to perform reset");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userName="Admin"
        balance={0}
        isAdmin={true}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{stats.userCount}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Total Trades</p>
            <p className="text-3xl font-bold text-gray-900">{stats.tradeCount}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Open Markets</p>
            <p className="text-3xl font-bold text-green-600">{stats.marketCounts.open}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Draft Markets</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.marketCounts.draft}</p>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Link href={`/control/${adminKey}/markets`} className="card hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Manage Markets</h2>
            <p className="text-gray-500 mb-4">Create, edit, and resolve prediction markets.</p>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">{stats.marketCounts.open} open</span>
              <span className="text-yellow-600">{stats.marketCounts.draft} draft</span>
              <span className="text-gray-400">{stats.marketCounts.resolved} resolved</span>
            </div>
          </Link>

          <Link href={`/control/${adminKey}/users`} className="card hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Manage Users</h2>
            <p className="text-gray-500 mb-4">View users and adjust balances.</p>
            <div className="text-sm text-gray-600">
              {stats.userCount} registered users
            </div>
          </Link>
          
          <Link href={`/control/${adminKey}/bots`} className="card hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Betting Bots</h2>
            <p className="text-gray-500 mb-4">Control the Grammy betting bots.</p>
            <div className="text-sm text-gray-600">
              10 bots with Bayesian learning
            </div>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href={`/control/${adminKey}/markets/new`} className="btn-primary">
              + Create Market
            </Link>
            <Link href={`/control/${adminKey}/bots`} className="btn-secondary">
              Control Bots
            </Link>
            <Link href="/live-odds" className="btn-secondary" target="_blank">
              Open Live Display ↗
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card bg-red-50 border-red-200 mb-8">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Danger Zone</h2>
          <p className="text-sm text-red-600 mb-4">
            These actions are destructive and cannot be undone.
          </p>
          
          {resetMessage && (
            <div className={`p-3 rounded mb-4 ${resetMessage.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
              {resetMessage}
            </div>
          )}
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleReset("reset-prices", "This will reset all market prices to equal odds. Continue?")}
              disabled={resetting}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
            >
              {resetting ? "Processing..." : "Reset Prices"}
            </button>
            
            <button
              onClick={() => handleReset("clear-users", "This will delete ALL users, positions, and transactions. Markets will remain but prices will reset. Continue?")}
              disabled={resetting}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
            >
              {resetting ? "Processing..." : "Clear All Users"}
            </button>
            
            <button
              onClick={() => handleReset("reset-all", "This will DELETE EVERYTHING and reseed fresh markets. All users, positions, and transactions will be lost. Are you absolutely sure?")}
              disabled={resetting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {resetting ? "Processing..." : "Full Reset (Reseed)"}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="card bg-blue-50 border-blue-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Admin Access</h2>
          <p className="text-sm text-gray-600">
            You&apos;re accessing the admin panel via secret URL. Bookmark this page to return quickly.
            Do not share this URL with non-administrators.
          </p>
        </div>
      </main>
    </div>
  );
}
