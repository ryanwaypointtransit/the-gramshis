/**
 * Bayesian learning model for Grammy betting bots
 * 
 * This module implements belief updating based on:
 * 1. Random factors (internal bot "belief")
 * 2. Kalshi market data (external information)
 * 3. Time-based weighting between random and Kalshi
 */

import { BOT_PERSONALITIES, BOT_CONFIG } from './config';
import { Bot, Market, Outcome, KalshiData } from './types';
import { calculateTimeBasedWeights, weightedRandomSelect } from './utils';

/**
 * Initialize beliefs for a bot across all markets
 * @param bot Bot to initialize beliefs for
 * @param markets Array of markets
 * @returns Bot with initialized beliefs
 */
export function initializeBeliefs(bot: Bot, markets: Market[]): Bot {
  const beliefs: { [marketId: number]: { [outcomeId: number]: number } } = {};
  const personality = BOT_PERSONALITIES[bot.name as keyof typeof BOT_PERSONALITIES];
  
  // For each market, initialize beliefs
  for (const market of markets) {
    beliefs[market.id] = {};
    
    // Get preferred categories for this bot
    const preferredCategories = personality.marketPreferences;
    const isPreferredMarket = preferredCategories.some(category => 
      MARKET_CATEGORIES_MAP[category]?.includes(market.name)
    );
    
    // Base probability is uniform across outcomes
    const baseProbability = 1 / market.outcomes.length;
    
    // For each outcome, set initial belief
    for (const outcome of market.outcomes) {
      // Add some randomness, more for preferred markets
      const randomFactor = isPreferredMarket ? 0.3 : 0.1;
      const randomization = (Math.random() * 2 - 1) * randomFactor;
      
      // Set initial belief (must be positive)
      beliefs[market.id][outcome.id] = Math.max(0.01, baseProbability + randomization);
    }
    
    // Normalize beliefs for this market to sum to 1
    normalizeMarketBeliefs(beliefs[market.id]);
  }
  
  return {
    ...bot,
    beliefs
  };
}

/**
 * Normalize beliefs for a market to sum to 1
 * @param marketBeliefs Beliefs for a specific market
 */
function normalizeMarketBeliefs(marketBeliefs: { [outcomeId: number]: number }): void {
  const sum = Object.values(marketBeliefs).reduce((acc, val) => acc + val, 0);
  
  for (const outcomeId in marketBeliefs) {
    marketBeliefs[outcomeId] /= sum;
  }
}

/**
 * Update bot beliefs based on Kalshi odds and time-based learning
 * @param bot Bot to update beliefs for
 * @param markets Array of all markets
 * @param kalshiData Kalshi odds data
 * @param startTime Start time of the event
 * @param currentTime Current time
 * @returns Updated bot
 */
export function updateBeliefs(
  bot: Bot,
  markets: Market[],
  kalshiData: KalshiData,
  startTime: number,
  currentTime: number
): Bot {
  // Copy beliefs to avoid mutation
  const updatedBeliefs = JSON.parse(JSON.stringify(bot.beliefs));
  
  // Get time-based weights for random vs. Kalshi
  const weights = calculateTimeBasedWeights(startTime, currentTime);
  
  // Get bot's learning rate from personality
  const learningRate = BOT_PERSONALITIES[bot.name as keyof typeof BOT_PERSONALITIES]?.learningRate || 0.7;
  
  // For each market, update beliefs
  for (const market of markets) {
    // Skip if market not in beliefs
    if (!updatedBeliefs[market.id]) continue;
    
    // Find corresponding Kalshi market
    const kalshiMarket = kalshiData[market.name];
    if (!kalshiMarket) continue;
    
    // Create mapping from outcome name to probability
    const kalshiProbabilities: { [name: string]: number } = {};
    for (const outcome of kalshiMarket.outcomes) {
      kalshiProbabilities[outcome.name] = outcome.probability;
    }
    
    // Update beliefs for each outcome
    for (const outcome of market.outcomes) {
      // Find matching Kalshi outcome by name
      let kalshiProbability = 0;
      
      // Look for exact or partial match in Kalshi data
      const exactMatch = kalshiProbabilities[outcome.name];
      if (exactMatch !== undefined) {
        kalshiProbability = exactMatch;
      } else {
        // Try to find partial match (e.g. "Golden" vs "Golden - HUNTR/X")
        const outcomeNameLower = outcome.name.toLowerCase();
        for (const kalshiName in kalshiProbabilities) {
          if (outcomeNameLower.includes(kalshiName.toLowerCase()) ||
              kalshiName.toLowerCase().includes(outcomeNameLower)) {
            kalshiProbability = kalshiProbabilities[kalshiName];
            break;
          }
        }
      }
      
      // Skip if no match found
      if (kalshiProbability === 0) continue;
      
      // Current belief
      const currentBelief = updatedBeliefs[market.id][outcome.id];
      
      // Weighted combination of current belief and Kalshi probability
      const updatedBelief = (
        currentBelief * weights.random +
        kalshiProbability * weights.kalshi
      );
      
      // Apply learning rate to control update speed
      updatedBeliefs[market.id][outcome.id] = 
        currentBelief * (1 - learningRate) + updatedBelief * learningRate;
    }
    
    // Normalize beliefs for this market to sum to 1
    normalizeMarketBeliefs(updatedBeliefs[market.id]);
  }
  
  return {
    ...bot,
    beliefs: updatedBeliefs
  };
}

/**
 * Select a market for the bot to bet on based on preferences and current state
 * @param bot Bot making the selection
 * @param markets Available markets
 * @param startTime Start time of event
 * @param currentTime Current time
 * @returns Selected market or null if no suitable market found
 */
export function selectMarket(
  bot: Bot, 
  markets: Market[],
  startTime: number,
  currentTime: number
): Market | null {
  // Get bot personality
  const personality = BOT_PERSONALITIES[bot.name as keyof typeof BOT_PERSONALITIES];
  
  // Filter for open markets only
  const openMarkets = markets.filter(m => m.status === 'open');
  if (openMarkets.length === 0) return null;
  
  // Weight markets by bot preferences and time-based progress
  const weights: number[] = openMarkets.map(market => {
    // Base weight
    let weight = 1;
    
    // Check if market is in preferred categories
    const isPreferred = personality.marketPreferences.some(category => 
      MARKET_CATEGORIES_MAP[category]?.includes(market.name)
    );
    
    if (isPreferred) {
      weight *= 3; // Triple weight for preferred markets
    }
    
    // Apply market-specific weight
    weight *= (MARKET_WEIGHTS as Record<string, number>)[market.name] || 1;
    
    // Slightly reduce weight if bot already has positions in this market
    // to encourage diversification
    const hasPosition = bot.positions.some(p => p.marketId === market.id);
    if (hasPosition) {
      weight *= 0.8;
    }
    
    return weight;
  });
  
  // Randomly select market with weights
  return weightedRandomSelect(openMarkets, weights);
}

/**
 * Select an outcome to bet on in the given market
 * @param bot Bot making the selection
 * @param market Market to bet on
 * @param startTime Start time of event
 * @param currentTime Current time
 * @param isWithdrawal Whether this is a withdrawal (sell) action
 * @returns Selected outcome or null if no suitable outcome found
 */
export function selectOutcome(
  bot: Bot,
  market: Market,
  startTime: number,
  currentTime: number,
  isWithdrawal: boolean = false
): Outcome | null {
  // Ensure market has outcomes
  if (!market.outcomes || market.outcomes.length === 0) return null;
  
  // Get bot's beliefs for this market
  const marketBeliefs = bot.beliefs[market.id] || {};
  
  // If withdrawal, prioritize outcomes where bot has existing positions
  if (isWithdrawal) {
    // Find positions in this market
    const marketPositions = bot.positions.filter(p => p.marketId === market.id);
    if (marketPositions.length === 0) return null;
    
    // Weight by position size
    const positionOutcomes = marketPositions.map(p => 
      market.outcomes.find(o => o.id === p.outcomeId)
    ).filter(Boolean) as Outcome[];
    
    const weights = marketPositions.map(p => p.shares);
    
    return weightedRandomSelect(positionOutcomes, weights);
  }
  
  // For normal bets, use beliefs to guide selection
  const outcomes = market.outcomes.filter(o => o.price && o.price > 0);
  if (outcomes.length === 0) return null;
  
  // Get time-based weights
  const timeWeights = calculateTimeBasedWeights(startTime, currentTime);
  
  // Calculate selection weights based on beliefs and time factors
  const weights = outcomes.map(outcome => {
    const belief = marketBeliefs[outcome.id] || (1 / market.outcomes.length);
    const price = outcome.price || 0.5;
    
    // Expected value calculation (simplistic)
    const expectedValue = belief / price;
    
    // Some randomness that decreases over time
    const randomFactor = 1 + (Math.random() - 0.5) * timeWeights.random;
    
    return expectedValue * randomFactor;
  });
  
  return weightedRandomSelect(outcomes, weights);
}

// Helper mapping from category names to market names
const MARKET_CATEGORIES_MAP: { [category: string]: string[] } = {};

// Initialize the map from the config
Object.entries(MARKET_CATEGORIES).forEach(([category, markets]) => {
  MARKET_CATEGORIES_MAP[category] = markets;
});

// Import at the end to avoid circular dependencies
import { MARKET_CATEGORIES, MARKET_WEIGHTS } from './config';