/**
 * Bot Configuration for Grammy Betting Bots
 */

export const BOT_CONFIG = {
  // Time-related settings
  PERIOD: 30 * 1000, // Milliseconds between bets per bot (default: 30 seconds)
  EVENING_LENGTH: 3 * 60 * 60 * 1000, // Duration of the Grammy event (3 hours)
  
  // Betting behavior
  BET_MEAN: 80, // Mean bet size in dollars
  BET_STD_DEV: 40, // Standard deviation of bet size
  MIN_BET: 10, // Minimum bet size to prevent tiny bets
  MAX_BET_PERCENT: 0.30, // Maximum percentage of available balance per bet
  
  // Bayesian learning
  INITIAL_RANDOM_WEIGHT: 0.9, // Initial weight for random selection (0-1)
  MIN_RANDOM_WEIGHT: 0.3, // Minimum randomness weight (never go below this)
  KALSHI_INFLUENCE_RATE: 0.05, // How much to update beliefs based on Kalshi odds
  
  // Operational settings
  STARTING_BALANCE: 1000, // Starting balance for each bot
  WITHDRAW_PROBABILITY: 0.3, // Probability a bot will withdraw from an existing position
  
  // Database
  BOT_USER_PREFIX: "bot_" // Prefix for bot usernames in the database
};

// Weightings for choosing markets
// Higher number = more likely to be chosen
export const MARKET_WEIGHTS = {
  "Song Of The Year": 10,
  "Best New Artist": 8,
  "Album Of The Year": 10,
  "Record Of The Year": 10,
  "Best Pop Solo Performance": 7,
  "Best Pop Duo/Group Performance": 7,
  "Best Pop Vocal Album": 6,
  "Best Rap Album": 7,
  "Best Rap Song": 6,
  "Best Alternative Music Performance": 5,
  "Best Dance/Electronic Album": 5,
  "Best Dance/Electronic Recording": 5,
  "Best Dance Pop Recording": 6,
  "Best Country Solo Performance": 5,
  "Best Contemporary Country Album": 4,
  "Best Remixed Recording": 4
};

// Market categories for diversification
export const MARKET_CATEGORIES = {
  "major": [
    "Song Of The Year",
    "Album Of The Year",
    "Record Of The Year",
    "Best New Artist"
  ],
  "pop": [
    "Best Pop Solo Performance",
    "Best Pop Duo/Group Performance",
    "Best Pop Vocal Album"
  ],
  "rap": [
    "Best Rap Album",
    "Best Rap Song"
  ],
  "alternative": [
    "Best Alternative Music Performance"
  ],
  "electronic": [
    "Best Dance/Electronic Album",
    "Best Dance/Electronic Recording",
    "Best Dance Pop Recording"
  ],
  "country": [
    "Best Country Solo Performance",
    "Best Contemporary Country Album"
  ],
  "other": [
    "Best Remixed Recording"
  ]
};

// Bot personalities to influence betting strategies
export const BOT_PERSONALITIES = {
  "Khia-Asylum": {
    description: "Passionate music fan with strong opinions",
    marketPreferences: ["major", "rap"],
    riskTolerance: 0.8, // 0-1, higher = more risk-taking
    learningRate: 0.7, // 0-1, higher = faster learning
  },
  "connor_toups_burner": {
    description: "Secretive bettor who makes unexpected moves",
    marketPreferences: ["electronic", "alternative"],
    riskTolerance: 0.6,
    learningRate: 0.5,
  },
  "MichalSkrrrrrreta": {
    description: "Trend-following bettor with a focus on rap",
    marketPreferences: ["rap", "pop"],
    riskTolerance: 0.7,
    learningRate: 0.8,
  },
  "Saif_Turkiye": {
    description: "International music enthusiast with diverse taste",
    marketPreferences: ["major", "electronic"],
    riskTolerance: 0.5,
    learningRate: 0.6,
  },
  "DroneStrikeRyan": {
    description: "Aggressive bettor who makes bold moves",
    marketPreferences: ["major", "electronic"],
    riskTolerance: 0.9,
    learningRate: 0.6,
  },
  "miguel(deCafe)": {
    description: "Calm, calculated bettor who watches market movements",
    marketPreferences: ["pop", "other"],
    riskTolerance: 0.4,
    learningRate: 0.9,
  },
  "Dogin5C": {
    description: "Chaotic bettor with unpredictable patterns",
    marketPreferences: ["alternative", "rap"],
    riskTolerance: 0.8,
    learningRate: 0.4,
  },
  "XXXAdam_HargusXXX": {
    description: "High-energy bettor focused on popular categories",
    marketPreferences: ["pop", "rap"],
    riskTolerance: 0.7,
    learningRate: 0.7,
  },
  "catherine_ooOOOoo": {
    description: "Methodical bettor who analyzes deeply",
    marketPreferences: ["country", "pop"],
    riskTolerance: 0.5,
    learningRate: 0.8,
  },
  "HiSomeritsJonathonPlsReply2Mytxts": {
    description: "Attention-seeking bettor who follows popular picks",
    marketPreferences: ["major", "pop"],
    riskTolerance: 0.6,
    learningRate: 0.7,
  }
};