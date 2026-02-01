/**
 * Utility functions for the Grammy betting bots
 */
import { BOT_CONFIG } from './config';
import { Bot, Market, Outcome, BotBet } from './types';

/**
 * Generate a random number from a normal distribution
 * @param mean Mean of the distribution
 * @param stdDev Standard deviation
 * @returns Random number from normal distribution
 */
export function normalRandom(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Generate a bet size following a normal distribution
 * @param availableBalance The available balance for this bot
 * @returns A bet size in dollars
 */
export function generateBetSize(availableBalance: number): number {
  const { BET_MEAN, BET_STD_DEV, MIN_BET, MAX_BET_PERCENT } = BOT_CONFIG;
  
  // Generate a random bet size
  let betSize = normalRandom(BET_MEAN, BET_STD_DEV);
  
  // Apply constraints
  betSize = Math.max(MIN_BET, betSize);
  betSize = Math.min(betSize, availableBalance * MAX_BET_PERCENT);
  betSize = Math.min(betSize, availableBalance);
  
  // Round to 2 decimal places
  return Math.round(betSize * 100) / 100;
}

/**
 * Calculate the random vs. Kalshi weighting based on the time elapsed
 * @param startTime Start time of the evening in milliseconds
 * @param currentTime Current time in milliseconds
 * @returns Object with weights for random selection and Kalshi odds
 */
export function calculateTimeBasedWeights(startTime: number, currentTime: number): { random: number, kalshi: number } {
  const { EVENING_LENGTH, INITIAL_RANDOM_WEIGHT, MIN_RANDOM_WEIGHT } = BOT_CONFIG;
  
  // Calculate how far through the evening we are (0 to 1)
  const progress = Math.min(1, Math.max(0, (currentTime - startTime) / EVENING_LENGTH));
  
  // Calculate the weight for randomness - decreases over time
  const randomWeight = INITIAL_RANDOM_WEIGHT - 
    (INITIAL_RANDOM_WEIGHT - MIN_RANDOM_WEIGHT) * progress;
  
  // Kalshi weight increases as random weight decreases
  const kalshiWeight = 1 - randomWeight;
  
  return { random: randomWeight, kalshi: kalshiWeight };
}

/**
 * Randomly select an item from an array with weights
 * @param items Array of items to choose from
 * @param weights Array of weights corresponding to items
 * @returns The selected item
 */
export function weightedRandomSelect<T>(items: T[], weights: number[]): T {
  // Normalize weights
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const normalizedWeights = weights.map(w => w / totalWeight);
  
  // Calculate cumulative weights
  const cumulativeWeights = [];
  let sum = 0;
  
  for (const weight of normalizedWeights) {
    sum += weight;
    cumulativeWeights.push(sum);
  }
  
  // Generate random number and find corresponding item
  const random = Math.random();
  
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (random <= cumulativeWeights[i]) {
      return items[i];
    }
  }
  
  // Fallback (should never happen if weights sum to 1)
  return items[items.length - 1];
}

/**
 * Calculate shares that can be bought with a given amount
 * This is a simplified version of the LMSR calculation
 * @param betAmount Amount in dollars to spend
 * @param price Current price of the outcome (0-1)
 * @returns Estimated number of shares
 */
export function estimateSharesFromAmount(betAmount: number, price: number): number {
  // Simple approximation: shares = amount / price
  // In reality, this depends on the LMSR parameters and market depth
  return betAmount / price;
}

/**
 * Format a timestamp as a readable time
 * @param timestamp Timestamp in milliseconds
 * @returns Formatted time string (HH:MM:SS)
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().substr(11, 8);
}

/**
 * Log a bot action with timestamp
 * @param botName Name of the bot
 * @param action Description of the action
 * @param details Optional details
 */
export function logBotAction(botName: string, action: string, details?: any): void {
  const timestamp = formatTime(Date.now());
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] 🤖 ${botName}: ${action}${detailsStr}`);
}

/**
 * Calculate the maximum number of shares a bot can withdraw from a position
 * @param position Current position in shares
 * @returns Maximum amount that can be withdrawn
 */
export function calculateMaxWithdrawal(position: number): number {
  // Allow withdrawing up to 100% of the position
  return Math.max(0, position);
}

/**
 * Get the share size for a bet (positive for buy, negative for sell)
 * @param bot The bot making the bet
 * @param market The market to bet on
 * @param outcome The outcome to bet on
 * @param betSize Amount in dollars to bet
 * @param isWithdrawal Whether this is a withdrawal
 * @returns Number of shares to buy/sell
 */
export function getBetShareSize(
  bot: Bot,
  market: Market,
  outcome: Outcome,
  betSize: number,
  isWithdrawal: boolean
): number {
  if (!outcome.price) return 0;
  
  // Find the bot's current position in this outcome
  const position = bot.positions.find(
    p => p.marketId === market.id && p.outcomeId === outcome.id
  );
  
  if (isWithdrawal && position) {
    // Calculate withdrawal amount (negative shares = selling)
    const maxWithdrawal = calculateMaxWithdrawal(position.shares);
    const sharesToWithdraw = Math.min(
      maxWithdrawal,
      estimateSharesFromAmount(betSize, outcome.price)
    );
    return -sharesToWithdraw;
  } else {
    // Calculate buy amount
    return estimateSharesFromAmount(betSize, outcome.price);
  }
}