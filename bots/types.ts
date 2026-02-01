/**
 * Type definitions for the Grammy betting bot system
 */

// Market and outcome data
export interface Market {
  id: number;
  name: string;
  status: 'draft' | 'open' | 'closed' | 'resolved';
  outcomes: Outcome[];
}

export interface Outcome {
  id: number;
  market_id: number;
  name: string;
  price?: number; // Current price in the market
}

// Bot state and configuration
export interface Bot {
  id: string;
  name: string;
  username: string;
  balance: number;
  personality: BotPersonality;
  beliefs: { [marketId: number]: { [outcomeId: number]: number } };
  positions: BotPosition[];
}

export interface BotPosition {
  marketId: number;
  outcomeId: number;
  shares: number;
  averagePrice: number;
}

export interface BotPersonality {
  description: string;
  marketPreferences: string[];
  riskTolerance: number;
  learningRate: number;
}

// Kalshi data
export interface KalshiData {
  [category: string]: {
    name: string;
    outcomes: {
      name: string;
      probability: number;
    }[];
  };
}

// Bet details
export interface BotBet {
  botId: string;
  marketId: number;
  outcomeId: number;
  shares: number;
  estimatedCost: number;
  timestamp: number;
}

// Event for the bot orchestrator
export interface BotEvent {
  type: 'PLACE_BET' | 'WITHDRAW' | 'UPDATE_BELIEFS' | 'START' | 'STOP';
  botId?: string;
  marketId?: number;
  data?: any;
  timestamp: number;
}

// Result of a bot action
export interface BotActionResult {
  success: boolean;
  botId: string;
  action: string;
  data?: any;
  error?: string;
}