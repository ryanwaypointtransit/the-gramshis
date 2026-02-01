"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminFetch } from "../layout";

interface User {
  id: number;
  name: string;
  display_name: string;
  balance: number;
  is_admin: number;
  created_at: string;
}

export default function AdminUsersPage() {
  const params = useParams();
  const adminKey = params.adminKey as string;
  const adminFetch = useAdminFetch();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Balance adjustment state
  const [adjustUserId, setAdjustUserId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/users");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch users");
        return;
      }

      setUsers(data.users);
    } catch {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const adjustBalance = async (userId: number) => {
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount)) {
      setError("Invalid amount");
      return;
    }

    setAdjustLoading(true);
    setError("");

    try {
      const res = await adminFetch(`/api/admin/users/${userId}/balance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: adjustReason }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to adjust balance");
      } else {
        setAdjustUserId(null);
        setAdjustAmount("");
        setAdjustReason("");
        await fetchUsers();
      }
    } catch {
      setError("Failed to adjust balance");
    } finally {
      setAdjustLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href={`/control/${adminKey}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">Manage Users</h1>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Display Name</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Balance</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Admin</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Joined</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{user.name}</td>
                  <td className="py-3 px-4 text-gray-900">{user.display_name}</td>
                  <td className="py-3 px-4 text-right font-mono text-gray-900">
                    ${user.balance.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {user.is_admin === 1 && (
                      <span className="text-xs bg-grammy-gold text-black px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setAdjustUserId(user.id)}
                      className="text-sm text-grammy-gold hover:underline"
                    >
                      Adjust Balance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Balance Adjustment Modal */}
        {adjustUserId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Adjust Balance for {users.find((u) => u.id === adjustUserId)?.display_name}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Balance
                  </label>
                  <p className="text-lg font-mono text-gray-900">
                    ${users.find((u) => u.id === adjustUserId)?.balance.toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjustment Amount
                  </label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g., 100 or -50"
                    className="input"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive to add, negative to subtract
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g., Bonus, Correction"
                    className="input"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => adjustBalance(adjustUserId)}
                  disabled={adjustLoading || !adjustAmount}
                  className="btn-primary disabled:opacity-50"
                >
                  {adjustLoading ? "Adjusting..." : "Confirm"}
                </button>
                <button
                  onClick={() => {
                    setAdjustUserId(null);
                    setAdjustAmount("");
                    setAdjustReason("");
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
