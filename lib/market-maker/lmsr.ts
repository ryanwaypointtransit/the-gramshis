/**
 * LMSR (Logarithmic Market Scoring Rule) Implementation
 *
 * The LMSR is a market maker algorithm that:
 * - Always provides liquidity (users can always buy/sell)
 * - Prices sum to exactly 1 (100%)
 * - Prices move based on shares outstanding
 *
 * Key formula: C(q) = b * ln(sum(e^(q_i/b)))
 * Price for outcome i: p_i = e^(q_i/b) / sum(e^(q_j/b))
 */

/**
 * Calculate the cost function C(q) for a set of share quantities
 */
export function costFunction(shares: number[], b: number): number {
  const sum = shares.reduce((acc, q) => acc + Math.exp(q / b), 0);
  return b * Math.log(sum);
}

/**
 * Calculate the price (probability) for each outcome
 * Prices always sum to 1 (100%)
 */
export function calculatePrices(shares: number[], b: number): number[] {
  const expValues = shares.map((q) => Math.exp(q / b));
  const sum = expValues.reduce((acc, val) => acc + val, 0);
  return expValues.map((val) => val / sum);
}

/**
 * Calculate the cost to buy/sell shares of a specific outcome
 * Positive shares = buy, Negative shares = sell
 *
 * Returns the cost (positive = user pays, negative = user receives)
 */
export function calculateTradeCost(
  currentShares: number[],
  outcomeIndex: number,
  sharesToTrade: number,
  b: number
): number {
  const beforeCost = costFunction(currentShares, b);

  const newShares = [...currentShares];
  newShares[outcomeIndex] += sharesToTrade;

  const afterCost = costFunction(newShares, b);

  return afterCost - beforeCost;
}

/**
 * Calculate the average price per share for a trade
 */
export function averagePricePerShare(
  currentShares: number[],
  outcomeIndex: number,
  sharesToTrade: number,
  b: number
): number {
  const cost = calculateTradeCost(currentShares, outcomeIndex, sharesToTrade, b);
  return Math.abs(cost / sharesToTrade);
}

/**
 * Calculate maximum shares that can be bought with a given budget
 * Uses binary search to find the exact amount
 */
export function maxSharesForBudget(
  currentShares: number[],
  outcomeIndex: number,
  budget: number,
  b: number
): number {
  let low = 0;
  let high = budget * 10; // Upper bound estimate

  // Binary search for max shares
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const cost = calculateTradeCost(currentShares, outcomeIndex, mid, b);

    if (cost <= budget) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Set initial shares to achieve target probabilities
 * Useful when importing odds from Kalshi
 *
 * Given target probabilities, calculates the shares needed
 * Formula: q_i = b * ln(p_i) + constant
 * The constant cancels out, so we use q_i = b * ln(p_i)
 */
export function sharesForTargetPrices(
  targetPrices: number[],
  b: number
): number[] {
  // Normalize prices to sum to 1
  const sum = targetPrices.reduce((acc, p) => acc + p, 0);
  const normalized = targetPrices.map((p) => p / sum);

  // Calculate shares: q_i = b * ln(p_i)
  // We add a constant to make all shares non-negative
  const rawShares = normalized.map((p) => b * Math.log(p));
  const minShare = Math.min(...rawShares);

  // Shift all shares to be non-negative
  return rawShares.map((q) => q - minShare);
}

/**
 * Calculate the payout for a winning outcome
 * Winning shares pay $1 each, losing shares pay $0
 */
export function calculatePayout(shares: number, isWinner: boolean): number {
  return isWinner ? shares : 0;
}

/**
 * Validate that a trade is possible
 * Returns an error message if invalid, null if valid
 */
export function validateTrade(
  currentShares: number[],
  outcomeIndex: number,
  sharesToTrade: number,
  userBalance: number,
  userPosition: number,
  b: number
): string | null {
  if (outcomeIndex < 0 || outcomeIndex >= currentShares.length) {
    return "Invalid outcome";
  }

  if (sharesToTrade === 0) {
    return "Cannot trade 0 shares";
  }

  if (sharesToTrade < 0) {
    // Selling - check user has enough shares
    if (Math.abs(sharesToTrade) > userPosition + 0.0001) {
      return "Insufficient shares to sell";
    }
  } else {
    // Buying - check user has enough balance
    const cost = calculateTradeCost(currentShares, outcomeIndex, sharesToTrade, b);
    if (cost > userBalance + 0.0001) {
      return "Insufficient balance";
    }
  }

  return null;
}

/**
 * Format price as percentage string
 */
export function formatPrice(price: number): string {
  return (price * 100).toFixed(1) + "%";
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return "$" + amount.toFixed(2);
}
