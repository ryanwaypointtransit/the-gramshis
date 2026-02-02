/**
 * Bot orchestrator for the Grammy betting system
 * 
 * Re-implemented to work with Neon Postgres async database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Bot, Market, KalshiData, BotBet } from './types';
import { BOT_CONFIG } from './config';
import { initializeBots, generateBotBet, updateBotAfterBet } from './botEngine';

// Global state
let isRunning: boolean = false;
let startTime: number = 0;
let bots: Bot[] = [];
let markets: Market[] = [];
let kalshiData: KalshiData = {};
let eventLoop: NodeJS.Timeout | null = null;

// API base URL - use environment variable or default to localhost
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface BotStatus {
  isRunning: boolean;
  startTime: number;
  botCount: number;
  marketCount: number;
  eventQueueLength: number;
  uptime: number;
  message?: string;
}

/**
 * Load bot names from bots.txt
 */
function loadBotNames(): string[] {
  const botsFilePath = path.join(process.cwd(), 'bots.txt');
  
  if (!fs.existsSync(botsFilePath)) {
    console.error('bots.txt not found at:', botsFilePath);
    return [];
  }
  
  const content = fs.readFileSync(botsFilePath, 'utf-8');
  const names = content.split('\n').map(n => n.trim()).filter(n => n.length > 0);
  
  return names;
}

/**
 * Load Kalshi odds data from grammy-odds.json
 */
function loadKalshiData(): KalshiData {
  const oddsFilePath = path.join(process.cwd(), 'grammy-odds.json');
  
  if (!fs.existsSync(oddsFilePath)) {
    console.warn('grammy-odds.json not found, using empty data');
    return {};
  }
  
  const content = fs.readFileSync(oddsFilePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Fetch markets from the API
 */
async function fetchMarkets(): Promise<Market[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/markets`);
    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status}`);
    }
    
    const data = await response.json();
    const fetchedMarkets = (data.markets || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      outcomes: m.outcomes || []
    }));
    
    return fetchedMarkets;
  } catch (error) {
    console.error('Failed to fetch markets:', error);
    return [];
  }
}

/**
 * Create or get a bot user via the login API
 */
async function createBotUser(botName: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: botName.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
    });
    
    return response.ok;
  } catch (error) {
    console.error(`Failed to create bot user ${botName}:`, error);
    return false;
  }
}

/**
 * Execute a bot trade via the API
 */
async function executeBotTrade(bet: BotBet, botUsername: string): Promise<{ success: boolean; cost: number }> {
  try {
    // First, login as the bot to get a session
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: botUsername })
    });
    
    if (!loginResponse.ok) {
      return { success: false, cost: 0 };
    }
    
    // Get the session cookie
    const cookies = loginResponse.headers.get('set-cookie');
    
    // Execute the trade
    const action = bet.shares > 0 ? 'buy' : 'sell';
    const tradeResponse = await fetch(`${API_BASE_URL}/api/markets/${bet.marketId}/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        outcomeId: bet.outcomeId,
        shares: Math.abs(bet.shares),
        action
      })
    });
    
    if (!tradeResponse.ok) {
      const errorData = await tradeResponse.json();
      console.log(`Trade failed for bot: ${errorData.error}`);
      return { success: false, cost: 0 };
    }
    
    const tradeData = await tradeResponse.json();
    return { success: true, cost: tradeData.trade?.totalCost || 0 };
  } catch (error) {
    console.error('Trade execution error:', error);
    return { success: false, cost: 0 };
  }
}

/**
 * Run a single bot tick - each bot makes a decision
 */
export async function runBotTick(force: boolean = false): Promise<void> {
  if ((!isRunning && !force) || bots.length === 0 || markets.length === 0) return;
  
  const currentTime = Date.now();
  
  // Refresh markets to get current prices
  markets = await fetchMarkets();
  
  // Each bot makes a decision
  for (const bot of bots) {
    const bet = generateBotBet(bot, markets, kalshiData, startTime, currentTime);
    
    if (bet) {
      const result = await executeBotTrade(bet, bot.username);
      
      if (result.success) {
        // Update bot state
        const botIndex = bots.findIndex(b => b.id === bot.id);
        if (botIndex !== -1) {
          bots[botIndex] = updateBotAfterBet(bot, bet, result.cost);
        }
      }
    }
  }
}

/**
 * Initialize the bot system
 */
export async function initialize(): Promise<boolean> {
  console.log('Loading bot names...');
  const botNames = loadBotNames();
  
  if (botNames.length === 0) {
    console.error('No bot names found in bots.txt');
    return false;
  }
  
  console.log(`Found ${botNames.length} bots`);
  
  // Load Kalshi odds data
  console.log('Loading Kalshi odds data...');
  kalshiData = loadKalshiData();
  console.log(`Loaded odds for ${Object.keys(kalshiData).length} categories`);
  
  // Fetch markets from API
  console.log('Fetching markets...');
  markets = await fetchMarkets();
  
  if (markets.length === 0) {
    console.error('No markets available. Make sure the server is running and markets are seeded.');
    return false;
  }
  
  console.log(`Found ${markets.length} markets`);
  
  // Create bot users
  console.log('Creating bot users...');
  for (const name of botNames) {
    await createBotUser(name);
  }
  
  // Initialize bots with beliefs
  console.log('Initializing bot beliefs...');
  bots = initializeBots(botNames, markets);
  
  console.log(`Initialized ${bots.length} bots`);
  return true;
}

/**
 * Start the bot system
 */
export function startSystem(): boolean {
  if (isRunning) {
    console.log('Bot system is already running');
    return false;
  }
  
  if (bots.length === 0) {
    console.error('No bots initialized. Call initialize() first.');
    return false;
  }
  
  isRunning = true;
  startTime = Date.now();
  
  console.log(`Starting bot system with ${bots.length} bots...`);
  console.log(`Bet interval: ${BOT_CONFIG.PERIOD / 1000} seconds`);
  
  // Start the event loop
  eventLoop = setInterval(async () => {
    await runBotTick();
  }, BOT_CONFIG.PERIOD);
  
  // Run first tick immediately
  runBotTick();
  
  return true;
}

/**
 * Stop the bot system
 */
export function stopSystem(): boolean {
  if (!isRunning) {
    return false;
  }
  
  isRunning = false;
  
  if (eventLoop) {
    clearInterval(eventLoop);
    eventLoop = null;
  }
  
  console.log('Bot system stopped');
  return true;
}

/**
 * Get current system status
 */
export function getStatus(): BotStatus {
  return {
    isRunning,
    startTime,
    botCount: bots.length,
    marketCount: markets.length,
    eventQueueLength: 0,
    uptime: isRunning ? Date.now() - startTime : 0
  };
}

/**
 * Close the bot system and clean up resources
 */
export function shutdown(): void {
  stopSystem();
  bots = [];
  markets = [];
  console.log('Bot system shut down');
}
