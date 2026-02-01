'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAdminFetch } from '../AdminContext';

/**
 * Admin interface for controlling the Grammy betting bots
 */
export default function BotAdminPage() {
  const params = useParams();
  const adminKey = params.adminKey as string;
  const adminFetch = useAdminFetch();
  
  const [botStatus, setBotStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch bot status
  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const response = await adminFetch('/api/admin/bots');
      const data = await response.json();
      
      if (response.ok) {
        setBotStatus(data.status);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch bot status');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize bot system
  const initializeBots = async () => {
    setIsLoading(true);
    setSuccessMessage('');
    try {
      const response = await adminFetch('/api/admin/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'initialize' }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccessMessage('Bot system initialized successfully!');
        fetchStatus();
      } else {
        setError(data.error || 'Failed to initialize bot system');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Start bot system
  const startBots = async () => {
    setIsLoading(true);
    setSuccessMessage('');
    try {
      const response = await adminFetch('/api/admin/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccessMessage('Bot system started!');
        fetchStatus();
      } else {
        setError(data.error || 'Failed to start bot system');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Stop bot system
  const stopBots = async () => {
    setIsLoading(true);
    setSuccessMessage('');
    try {
      const response = await adminFetch('/api/admin/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccessMessage('Bot system stopped!');
        fetchStatus();
      } else {
        setError(data.error || 'Failed to stop bot system');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh status every 10 seconds
  useEffect(() => {
    fetchStatus();
    
    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Format time
  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    
    return new Date(timestamp).toLocaleTimeString();
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (!ms) return 'N/A';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto">
        <Link href={`/control/${adminKey}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Admin
        </Link>
        <h1 className="text-2xl font-bold mb-6 mt-2">Grammy Betting Bots Control Panel</h1>
        
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
        
        <div className="flex space-x-4 mb-6">
          <button
            onClick={initializeBots}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Initialize
          </button>
          
          <button
            onClick={startBots}
            disabled={isLoading || !botStatus || !botStatus.botCount}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Start
          </button>
          
          <button
            onClick={stopBots}
            disabled={isLoading || !botStatus || !botStatus.isRunning}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Stop
          </button>
          
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Refresh Status
          </button>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Bot System Status</h2>
          
          {isLoading ? (
            <p>Loading status...</p>
          ) : !botStatus ? (
            <p>No status available. Please initialize the bot system.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Status:</p>
                <p className="font-semibold">
                  {botStatus.isRunning ? (
                    <span className="text-green-600">Running</span>
                  ) : (
                    <span className="text-red-600">Stopped</span>
                  )}
                </p>
              </div>
              
              <div>
                <p className="text-gray-600">Bot Count:</p>
                <p className="font-semibold">{botStatus.botCount}</p>
              </div>
              
              <div>
                <p className="text-gray-600">Markets:</p>
                <p className="font-semibold">{botStatus.marketCount}</p>
              </div>
              
              <div>
                <p className="text-gray-600">Pending Events:</p>
                <p className="font-semibold">{botStatus.eventQueueLength || 0}</p>
              </div>
              
              <div>
                <p className="text-gray-600">Start Time:</p>
                <p className="font-semibold">{formatTime(botStatus.startTime)}</p>
              </div>
              
              <div>
                <p className="text-gray-600">Uptime:</p>
                <p className="font-semibold">{formatDuration(botStatus.uptime)}</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Bot Configuration</h2>
          <p className="mb-2">Current configuration:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Betting Period: 30 seconds</li>
            <li>Bet Size: Normal distribution with mean $80, std $40</li>
            <li>Starting Balance: $1,000 per bot</li>
            <li>Bot Count: 10 bots from bots.txt</li>
            <li>Evening Length: 3 hours</li>
          </ul>
          <p className="text-sm text-gray-600">
            To change configuration parameters, edit the bots/config.ts file.
          </p>
        </div>
      </div>
    </div>
  );
}
