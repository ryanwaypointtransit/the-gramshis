/**
 * Bot decision engine for Grammy betting
 * Manages the decision-making process for bots, including market selection,
 * outcome selection, and bet sizing
 */

import { BOT_CONFIG, BOT_PERSONALITIES } from './config';
import { Bot, Market, Outcome, BotBet, KalshiData } from './types';
import { 
  generateBetSize,
  getBetShareSize,
  logBotAction
} from './utils';
import {
  initializeBeliefs,
  updateBeliefs,
  selectMarket,
  selectOutcome
} from './bayesian';

/**
 * Initialize a new bot with starting balance and empty positions
 * @param name Bot name from bots.txt
 * @returns Initialized bot object
 */
export function createBot(name: string): Bot {
  return {
    id: `bot_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name,
    username: `${BOT_CONFIG.BOT_USER_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    balance: BOT_CONFIG.STARTING_BALANCE,
    personality: BOT_PERSONALITIES[name] || {
      description: "Generic bot personality",
      marketPreferences: ["major"],
      riskTolerance: 0.5,
      learningRate: 0.7
    },
    beliefs: {},
    positions: []
  };
}

/**
 * Create an array of bots from the list of names
 * @param botNames Array of bot names
 * @param markets Available markets for initializing beliefs
 * @returns Array of initialized bots
 */
export function initializeBots(botNames: string[], markets: Market[]): Bot[] {
  return botNames.map(name => {
    const bot = createBot(name);
    return initializeBeliefs(bot, markets);
  });
}

/**
 * Decide whether to place a new bet or withdraw from an existing position
 * @param bot Bot making the decision
 * @returns True if the bot should withdraw, false to place a new bet
 */
export function shouldWithdraw(bot: Bot): boolean {
  // Check if bot has any positions to withdraw from
  if (bot.positions.length === 0) return false;
  
  // Withdraw probability is influenced by personality's risk tolerance
  // More risk-tolerant bots are less likely to withdraw
  const personality = BOT_PERSONALITIES[bot.name];
  const adjustedProbability = BOT_CONFIG.WITHDRAW_PROBABILITY * (1 - (personality.riskTolerance * 0.5));
  
  return Math.random() < adjustedProbability;
}

/**
 * Generate a bot bet based on the current state
 * @param bot Bot making the bet
 * @param markets Available markets
 * @param kalshiData Kalshi odds data for belief updating
 * @param startTime Start time of the event
 * @param currentTime Current time
 * @returns Bet details or null if no valid bet can be made
 */
export function generateBotBet(
  bot: Bot,
  markets: Market[],
  kalshiData: KalshiData,
  startTime: number,
  currentTime: number
): BotBet | null {
  // Update beliefs based on current Kalshi data
  const updatedBot = updateBeliefs(bot, markets, kalshiData, startTime, currentTime);
  
  // Decide whether to place a new bet or withdraw
  const isWithdrawal = shouldWithdraw(updatedBot);
  
  // Select market to bet on
  const selectedMarket = selectMarket(updatedBot, markets, startTime, currentTime);
  if (!selectedMarket) return null;
  
  // Select outcome within that market
  const selectedOutcome = selectOutcome(
    updatedBot,
    selectedMarket,
    startTime,
    currentTime,
    isWithdrawal
  );
  if (!selectedOutcome) return null;
  
  // Generate bet size
  const betSize = generateBetSize(updatedBot.balance);
  if (betSize <= 0) return null;
  
  // Calculate shares to buy/sell
  const shares = getBetShareSize(
    updatedBot,
    selectedMarket,
    selectedOutcome,
    betSize,
    isWithdrawal
  );
  
  // Skip if shares is zero or too small
  if (Math.abs(shares) < 0.01) return null;
  
  // Calculate estimated cost
  const price = selectedOutcome.price || 0.5;
  const estimatedCost = shares * price;
  
  // Log the action
  const action = isWithdrawal ? "Withdrawing" : "Betting";
  logBotAction(
    updatedBot.name, 
    `${action} ${Math.abs(shares).toFixed(2)} shares on "${selectedOutcome.name}" in ${selectedMarket.name}`,
    { cost: estimatedCost.toFixed(2) }
  );
  
  // Return the bet details
  return {
    botId: updatedBot.id,
    marketId: selectedMarket.id,
    outcomeId: selectedOutcome.id,
    shares,
    estimatedCost,
    timestamp: currentTime
  };
}

/**
 * Update bot state after a bet has been executed
 * @param bot Bot that made the bet
 * @param bet Bet that was placed
 * @param actualCost Actual cost of the bet (from LMSR)
 * @returns Updated bot
 */
export function updateBotAfterBet(bot: Bot, bet: BotBet, actualCost: number): Bot {
  // Update bot balance
  const newBalance = bot.balance - actualCost;
  
  // Update positions
  let newPositions = [...bot.positions];
  
  // Find existing position for this outcome
  const existingPosition = newPositions.find(
    p => p.marketId === bet.marketId && p.outcomeId === bet.outcomeId
  );
  
  if (existingPosition) {
    // Update existing position
    const newShares = existingPosition.shares + bet.shares;
    
    if (newShares <= 0) {
      // If no shares left, remove position
      newPositions = newPositions.filter(
        p => !(p.marketId === bet.marketId && p.outcomeId === bet.outcomeId)
      );
    } else {
      // Update position
      const newAveragePrice = (
        (existingPosition.averagePrice * existingPosition.shares) +
        (actualCost / bet.shares) * bet.shares
      ) / newShares;
      
      existingPosition.shares = newShares;
      existingPosition.averagePrice = newAveragePrice;
    }
  } else if (bet.shares > 0) {
    // Add new position if buying
    newPositions.push({
      marketId: bet.marketId,
      outcomeId: bet.outcomeId,
      shares: bet.shares,
      averagePrice: actualCost / bet.shares
    });
  }
  
  return {
    ...bot,
    balance: newBalance,
    positions: newPositions
  };
}