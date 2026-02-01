"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAdminFetch } from "../../layout";

export default function NewMarketPage() {
  const router = useRouter();
  const params = useParams();
  const adminKey = params.adminKey as string;
  const adminFetch = useAdminFetch();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addOutcome = () => {
    setOutcomes([...outcomes, ""]);
  };

  const removeOutcome = (index: number) => {
    if (outcomes.length <= 2) return;
    setOutcomes(outcomes.filter((_, i) => i !== index));
  };

  const updateOutcome = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validOutcomes = outcomes.filter((o) => o.trim());
    if (!name.trim()) {
      setError("Market name is required");
      return;
    }
    if (validOutcomes.length < 2) {
      setError("At least 2 outcomes are required");
      return;
    }

    setLoading(true);

    try {
      const res = await adminFetch("/api/admin/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          outcomes: validOutcomes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create market");
      } else {
        router.push(`/control/${adminKey}/markets/${data.marketId}`);
      }
    } catch {
      setError("Failed to create market");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/control/${adminKey}/markets`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Markets
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">Create New Market</h1>

        <form onSubmit={handleSubmit} className="card space-y-6">
          {/* Market Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Market Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Best New Artist"
              className="input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about this market..."
              className="input min-h-[80px]"
            />
          </div>

          {/* Outcomes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Outcomes * (at least 2)
            </label>
            <div className="space-y-3">
              {outcomes.map((outcome, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => updateOutcome(index, e.target.value)}
                    placeholder={`Outcome ${index + 1}`}
                    className="input flex-1"
                  />
                  {outcomes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOutcome(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOutcome}
              className="mt-3 text-sm text-grammy-gold hover:underline"
            >
              + Add Another Outcome
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Market"}
            </button>
            <Link href={`/control/${adminKey}/markets`} className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">What happens next?</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Market will be created in &quot;draft&quot; status</li>
            <li>Set initial odds (import from Kalshi or set manually)</li>
            <li>Open the market for trading</li>
            <li>When ready, resolve the market and pay out winners</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
