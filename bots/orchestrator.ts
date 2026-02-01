/**
 * Bot orchestrator for the Grammy betting system
 * 
 * This module coordinates the activities of all bots, scheduling their
 * bet placements and managing the overall simulation.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { BOT_CONFIG } from './config';
import { Bot, Market, BotEvent, BotBet, KalshiData } from './types';
import { formatTime, logBotAction } from './utils';
import { initializeBots, generateBotBet, updateBotAfterBet } from './botEngine';
import { calculateTradeCost, sharesForTargetPrices } from '../lib/market-maker/lmsr';

// Global state
let bots: Bot[] = [];
let markets: Market[] = [];
let eventQueue: BotEvent[] = [];
let eventLoop: NodeJS.Timeout | null = null;
let startTime: number = 0;
let isRunning: boolean = false;
let kalshiData: KalshiData = {};
let db: Database.Database | null = null;

// LMSR constants
const LMSR_B = 100; // Liquidity parameter

/**
 * Load bot names from the bots.txt file
 * @returns Array of bot names
 */
function loadBotNames(): string[] {
  try {
    const botsFile = path.join(process.cwd(), 'bots.txt');
    const content = fs.readFileSync(botsFile, 'utf8');
    return content.split('\n').filter(name => name.trim() !== '');
  } catch (error) {
    console.error('Error loading bot names:', error);
    return [];
  }
}

/**
 * Load market data from the database
 * @returns Array of markets with outcomes
 */
function loadMarkets(): Market[] {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Load markets
    const marketsQuery = db.prepare(`
      SELECT id, name, status
      FROM markets
      WHERE status = 'open'
    `);
    
    const marketsData = marketsQuery.all() as Market[];
    
    // Load outcomes for each market
    const outcomesQuery = db.prepare(`
      SELECT id, market_id, name
      FROM outcomes
      WHERE market_id IN (${marketsData.map(m => m.id).join(',')})
    `);
    
    const allOutcomes = outcomesQuery.all() as Outcome[];
    
    // Get current prices from the database
    const sharesQuery = db.prepare(`
      SELECT market_id, outcome_id, shares
      FROM market_maker
      WHERE market_id IN (${marketsData.map(m => m.id).join(',')})
    `);
    
    const sharesData = sharesQuery.all() as { market_id: number, outcome_id: number, shares: number }[];
    
    // Organize shares by market
    const marketShares: { [marketId: number]: { [outcomeId: number]: number } } = {};
    for (const { market_id, outcome_id, shares } of sharesData) {
      if (!marketShares[market_id]) {
        marketShares[market_id] = {};
      }
      marketShares[market_id][outcome_id] = shares;
    }
    
    // Calculate prices using LMSR
    for (const marketId in marketShares) {
      const outcomesShares = Object.values(marketShares[marketId]);
      const prices = calculatePrices(outcomesShares, LMSR_B);
      
      let i = 0;
      for (const outcomeId in marketShares[marketId]) {
        // Find the outcome and set its price
        const outcome = allOutcomes.find(o => 
          o.market_id === Number(marketId) && o.id === Number(outcomeId)
        );
        
        if (outcome) {
          (outcome as any).price = prices[i];
        }
        
        i++;
      }
    }
    
    // Add outcomes to markets
    return marketsData.map(market => {
      const outcomes = allOutcomes.filter(o => o.market_id === market.id);
      return {
        ...market,
        outcomes
      };
    });
  } catch (error) {
    console.error('Error loading markets:', error);
    return [];
  }
}

/**
 * Calculate prices using LMSR formula
 */
function calculatePrices(shares: number[], b: number): number[] {
  const expValues = shares.map(q => Math.exp(q / b));
  const sum = expValues.reduce((acc, val) => acc + val, 0);
  return expValues.map(val => val / sum);
}

/**
 * Load Kalshi data from the grammy-odds.json file
 * @returns Kalshi odds data
 */
function loadKalshiData(): KalshiData {
  try {
    const kalshiFile = path.join(process.cwd(), 'grammy-odds.json');
    
    if (fs.existsSync(kalshiFile)) {
      const content = fs.readFileSync(kalshiFile, 'utf8');
      return JSON.parse(content);
    } else {
      console.warn('Kalshi data file not found, using empty data');
      return {};
    }
  } catch (error) {
    console.error('Error loading Kalshi data:', error);
    return {};
  }
}

/**
 * Create bot users in the database if they don't exist
 */
async function createBotUsers() {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Check if users table exists
    const userTable = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='users'
    `).get();
    
    if (!userTable) {
      console.warn('Users table not found, skipping bot user creation');
      return;
    }
    
    // For each bot, create a user if it doesn't exist
    for (const bot of bots) {
      const existingUser = db.prepare(`
        SELECT id FROM users WHERE username = ?
      `).get(bot.username);
      
      if (!existingUser) {
        db.prepare(`
          INSERT INTO users (username, password, balance, is_admin)
          VALUES (?, ?, ?, 0)
        `).run(bot.username, 'bot_password_hash', BOT_CONFIG.STARTING_BALANCE);
        
        console.log(`Created bot user: ${bot.username}`);
      }
    }
  } catch (error) {
    console.error('Error creating bot users:', error);
  }
}

/**
 * Initialize the bot system
 */
export async function initialize(dbPath: string = path.join(process.cwd(), 'gramshis.db')) {
  try {
    // Open database
    db = new Database(dbPath);
    
    // Load data
    const botNames = loadBotNames();
    markets = loadMarkets();
    kalshiData = loadKalshiData();
    
    // Create bots
    bots = initializeBots(botNames, markets);
    
    // Ensure bot users exist
    await createBotUsers();
    
    console.log(`Initialized ${bots.length} bots`);
    console.log(`Loaded ${markets.length} markets`);
    console.log(`Loaded Kalshi data for ${Object.keys(kalshiData).length} markets`);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize bot system:', error);
    return false;
  }
}

/**
 * Start the bot system
 */
export function startSystem() {
  if (isRunning) {
    console.log('Bot system is already running');
    return false;
  }
  
  startTime = Date.now();
  isRunning = true;
  
  // Schedule initial events
  scheduleInitialEvents();
  
  // Start event loop
  eventLoop = setInterval(processNextEvent, 100);
  
  console.log(`Bot system started at ${formatTime(startTime)}`);
  return true;
}

/**
 * Stop the bot system
 */
export function stopSystem() {
  if (!isRunning) {
    console.log('Bot system is not running');
    return false;
  }
  
  isRunning = false;
  
  // Clear event loop
  if (eventLoop) {
    clearInterval(eventLoop);
    eventLoop = null;
  }
  
  // Clear event queue
  eventQueue = [];
  
  console.log(`Bot system stopped at ${formatTime(Date.now())}`);
  return true;
}

/**
 * Schedule the initial betting events for all bots
 */
function scheduleInitialEvents() {
  // Clear existing events
  eventQueue = [];
  
  // Schedule initial bets with random offsets
  for (const bot of bots) {
    const randomOffset = Math.random() * BOT_CONFIG.PERIOD;
    
    eventQueue.push({
      type: 'PLACE_BET',
      botId: bot.id,
      timestamp: startTime + randomOffset
    });
  }
  
  // Sort events by timestamp
  eventQueue.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Process the next event in the queue
 */
function processNextEvent() {
  if (!isRunning || eventQueue.length === 0) return;
  
  const currentTime = Date.now();
  const nextEvent = eventQueue[0];
  
  // Skip if event is in the future
  if (nextEvent.timestamp > currentTime) return;
  
  // Remove event from queue
  eventQueue.shift();
  
  // Process event based on type
  switch (nextEvent.type) {
    case 'PLACE_BET':
      processBetEvent(nextEvent, currentTime);
      break;
      
    case 'UPDATE_BELIEFS':
      // Future enhancement: periodic belief updates
      break;
      
    default:
      console.warn(`Unknown event type: ${nextEvent.type}`);
  }
}

/**
 * Process a bet placement event
 */
function processBetEvent(event: BotEvent, currentTime: number) {
  if (!event.botId) return;
  
  // Find the bot
  const bot = bots.find(b => b.id === event.botId);
  if (!bot) return;
  
  try {
    // Generate a bet for this bot
    const bet = generateBotBet(
      bot,
      markets,
      kalshiData,
      startTime,
      currentTime
    );
    
    if (bet) {
      // Execute the bet (would normally interact with the database)
      executeBet(bet);
    }
    
    // Schedule next bet for this bot
    scheduleNextBet(bot.id, currentTime);
  } catch (error) {
    console.error(`Error processing bet for ${bot.name}:`, error);
    
    // Still schedule next bet even if this one failed
    scheduleNextBet(bot.id, currentTime);
  }
}

/**
 * Schedule the next bet for a bot
 */
function scheduleNextBet(botId: string, currentTime: number) {
  // Random variation in period (±20%)
  const variation = BOT_CONFIG.PERIOD * 0.2;
  const randomPeriod = BOT_CONFIG.PERIOD + (Math.random() * 2 - 1) * variation;
  
  // Add event to queue
  eventQueue.push({
    type: 'PLACE_BET',
    botId,
    timestamp: currentTime + randomPeriod
  });
  
  // Sort events by timestamp
  eventQueue.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Execute a bot's bet in the database
 */
function executeBet(bet: BotBet) {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // Find the bot
    const botIndex = bots.findIndex(b => b.id === bet.botId);
    if (botIndex === -1) return;
    
    const bot = bots[botIndex];
    
    // Find the user ID from username
    const userQuery = db.prepare(`
      SELECT id FROM users WHERE username = ?
    `);
    
    const user = userQuery.get(bot.username) as { id: number } | undefined;
    if (!user) {
      throw new Error(`Bot user ${bot.username} not found in database`);
    }
    
    // Get current shares from market_maker table
    const sharesQuery = db.prepare(`
      SELECT shares FROM market_maker
      WHERE market_id = ? AND outcome_id = ?
    `);
    
    const sharesData = sharesQuery.get(bet.marketId, bet.outcomeId) as { shares: number } | undefined;
    const currentShares = sharesData ? sharesData.shares : 0;
    
    // Execute the transaction using LMSR
    db.transaction(() => {
      // Calculate actual cost using LMSR
      const marketSharesQuery = db.prepare(`
        SELECT outcome_id, shares FROM market_maker
        WHERE market_id = ?
      `);
      
      const allShares = marketSharesQuery.all(bet.marketId) as { outcome_id: number, shares: number }[];
      
      // Convert to array for LMSR calculation
      const shareArray = [];
      const outcomeIds = [];
      
      for (const data of allShares) {
        outcomeIds.push(data.outcome_id);
        shareArray.push(data.shares);
      }
      
      // If outcome not found in existing shares, add it
      let outcomeIndex = outcomeIds.indexOf(bet.outcomeId);
      if (outcomeIndex === -1) {
        outcomeIds.push(bet.outcomeId);
        shareArray.push(0);
        outcomeIndex = shareArray.length - 1;
      }
      
      // Calculate cost
      const cost = calculateTradeCost(shareArray, outcomeIndex, bet.shares, LMSR_B);
      
      // Update market_maker table
      const updateSharesQuery = db.prepare(`
        INSERT INTO market_maker (market_id, outcome_id, shares)
        VALUES (?, ?, ?)
        ON CONFLICT(market_id, outcome_id) DO UPDATE SET
        shares = shares + ?
      `);
      
      updateSharesQuery.run(bet.marketId, bet.outcomeId, bet.shares, bet.shares);
      
      // Update bot user balance
      const updateBalanceQuery = db.prepare(`
        UPDATE users SET balance = balance - ? WHERE id = ?
      `);
      
      updateBalanceQuery.run(cost, user.id);
      
      // Add position record
      const addPositionQuery = db.prepare(`
        INSERT INTO positions (user_id, market_id, outcome_id, shares)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, market_id, outcome_id) DO UPDATE SET
        shares = shares + ?
      `);
      
      addPositionQuery.run(user.id, bet.marketId, bet.outcomeId, bet.shares, bet.shares);
      
      // Add transaction record
      const addTransactionQuery = db.prepare(`
        INSERT INTO transactions (user_id, market_id, outcome_id, shares, price, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      addTransactionQuery.run(
        user.id,
        bet.marketId,
        bet.outcomeId,
        bet.shares,
        cost / bet.shares,
        new Date().toISOString()
      );
      
      // Update bot state in memory
      bots[botIndex] = updateBotAfterBet(bot, bet, cost);
      
      // Log transaction
      logBotAction(
        bot.name,
        `Transaction complete`,
        { shares: bet.shares, cost, outcome_id: bet.outcomeId }
      );
    })();
  } catch (error) {
    console.error('Error executing bet:', error);
  }
}

/**
 * Get current system status
 */
export function getStatus() {
  return {
    isRunning,
    startTime,
    botCount: bots.length,
    marketCount: markets.length,
    eventQueueLength: eventQueue.length,
    uptime: isRunning ? Date.now() - startTime : 0
  };
}

/**
 * Close the bot system and clean up resources
 */
export function shutdown() {
  stopSystem();
  
  // Close database
  if (db) {
    db.close();
    db = null;
  }
  
  console.log('Bot system shut down');
}