'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAdminFetch } from '../AdminContext';

interface BotTransaction {
  id: number;
  bot_name: string;
  outcome_name: string;
  market_name: string;
  shares: number;
  total_cost: number;
  created_at: string;
}

/**
 * Admin interface for Grammy betting bots (cron-based)
 */
export default function BotAdminPage() {
  const params = useParams();
  const adminKey = params.adminKey as string;
  const adminFetch = useAdminFetch();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [recentTrades, setRecentTrades] = useState<BotTransaction[]>([]);
  const [tickResult, setTickResult] = useState<any>(null);

  // Fetch recent bot trades
  const fetchRecentTrades = async () => {
    try {
      const response = await adminFetch('/api/admin/bots/recent-trades');
      const data = await response.json();
      
      if (response.ok) {
        setRecentTrades(data.trades || []);
      }
    } catch (err) {
      console.error('Failed to fetch recent trades');
    }
  };

  // Manually trigger a bot tick
  const triggerBotTick = async () => {
    setIsLoading(true);
    setSuccessMessage('');
    setError('');
    setTickResult(null);
    
    try {
      const response = await adminFetch('/api/admin/bots/trigger-tick', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(`Bot tick completed! ${data.trades} trades executed.`);
        setTickResult(data);
        fetchRecentTrades();
      } else {
        setError(data.error || 'Failed to trigger bot tick');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh trades every 30 seconds
  useEffect(() => {
    fetchRecentTrades();
    
    const interval = setInterval(() => {
      fetchRecentTrades();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto">
        <Link href={`/control/${adminKey}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Admin
        </Link>
        <h1 className="text-2xl font-bold mb-6 mt-2">Grammy Betting Bots</h1>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
            <p>{successMessage}</p>
          </div>
        )}

        {/* Cron Status */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Automated Trading</h2>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-700 font-medium">Bots run automatically via Vercel Cron (every minute)</span>
          </div>
          <p className="text-gray-600 mb-4">
            Each minute, bots have a 30% chance to make a trade. This creates natural market activity.
          </p>
          
          <button
            onClick={triggerBotTick}
            disabled={isLoading}
            className="bg-grammy-gold hover:bg-grammy-gold-light text-black font-bold py-2 px-6 rounded disabled:opacity-50"
          >
            {isLoading ? 'Running...' : 'Trigger Bot Tick Now'}
          </button>
        </div>

        {/* Tick Result */}
        {tickResult && tickResult.results && tickResult.results.length > 0 && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Last Tick Results</h2>
            <div className="space-y-2">
              {tickResult.results.map((trade: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{trade.bot}</span>
                  <span className="text-gray-600">
                    bought {trade.shares} shares of {trade.outcome.substring(0, 30)}...
                  </span>
                  <span className="text-green-600 font-mono">${trade.cost}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Trades */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Bot Trades</h2>
            <button
              onClick={fetchRecentTrades}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Refresh
            </button>
          </div>
          
          {recentTrades.length === 0 ? (
            <p className="text-gray-500">No recent bot trades. Click &quot;Trigger Bot Tick Now&quot; to generate activity.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Bot</th>
                    <th className="text-left py-2">Market</th>
                    <th className="text-left py-2">Outcome</th>
                    <th className="text-right py-2">Shares</th>
                    <th className="text-right py-2">Cost</th>
                    <th className="text-right py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr key={trade.id} className="border-b">
                      <td className="py-2 font-medium">{trade.bot_name}</td>
                      <td className="py-2 text-gray-600">{trade.market_name}</td>
                      <td className="py-2">{trade.outcome_name?.substring(0, 25)}...</td>
                      <td className="py-2 text-right font-mono">{Number(trade.shares).toFixed(1)}</td>
                      <td className="py-2 text-right font-mono text-green-600">${Number(trade.total_cost).toFixed(2)}</td>
                      <td className="py-2 text-right text-gray-500">
                        {new Date(trade.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bot Info */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Bot Configuration</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Bot Count:</p>
              <p className="font-semibold">10 bots</p>
            </div>
            <div>
              <p className="text-gray-600">Trade Frequency:</p>
              <p className="font-semibold">~3 trades/minute</p>
            </div>
            <div>
              <p className="text-gray-600">Bet Size Range:</p>
              <p className="font-semibold">$10 - $100</p>
            </div>
            <div>
              <p className="text-gray-600">Starting Balance:</p>
              <p className="font-semibold">$1,000 each</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
