// Test script for LMSR algorithm
// Run with: npx ts-node scripts/test-lmsr.ts

import {
  calculatePrices,
  calculateTradeCost,
  sharesForTargetPrices,
  validateTrade,
} from "../lib/market-maker/lmsr";

const b = 100; // liquidity parameter

console.log("=== LMSR Algorithm Tests ===\n");

// Test 1: Initial prices with equal shares
console.log("Test 1: Equal shares should give equal prices");
const equalShares = [0, 0, 0];
const equalPrices = calculatePrices(equalShares, b);
console.log(`  Shares: [${equalShares.join(", ")}]`);
console.log(`  Prices: [${equalPrices.map((p) => (p * 100).toFixed(2) + "%").join(", ")}]`);
console.log(`  Sum: ${(equalPrices.reduce((a, b) => a + b, 0) * 100).toFixed(2)}%`);
console.log(`  Pass: ${Math.abs(equalPrices[0] - 1 / 3) < 0.001 ? "✓" : "✗"}\n`);

// Test 2: Prices sum to 100%
console.log("Test 2: Prices always sum to 100%");
const unequalShares = [50, 100, 25];
const unequalPrices = calculatePrices(unequalShares, b);
console.log(`  Shares: [${unequalShares.join(", ")}]`);
console.log(`  Prices: [${unequalPrices.map((p) => (p * 100).toFixed(2) + "%").join(", ")}]`);
const sum = unequalPrices.reduce((a, b) => a + b, 0);
console.log(`  Sum: ${(sum * 100).toFixed(2)}%`);
console.log(`  Pass: ${Math.abs(sum - 1) < 0.001 ? "✓" : "✗"}\n`);

// Test 3: Set target prices
console.log("Test 3: Set initial odds from Kalshi (60%, 30%, 10%)");
const targetPrices = [0.6, 0.3, 0.1];
const targetShares = sharesForTargetPrices(targetPrices, b);
const resultPrices = calculatePrices(targetShares, b);
console.log(`  Target: [${targetPrices.map((p) => (p * 100).toFixed(1) + "%").join(", ")}]`);
console.log(`  Shares: [${targetShares.map((s) => s.toFixed(2)).join(", ")}]`);
console.log(`  Result: [${resultPrices.map((p) => (p * 100).toFixed(1) + "%").join(", ")}]`);
console.log(`  Pass: ${Math.abs(resultPrices[0] - 0.6) < 0.01 ? "✓" : "✗"}\n`);

// Test 4: Buy shares moves price up
console.log("Test 4: Buying shares increases price");
const shares4 = [50, 50];
const pricesBefore = calculatePrices(shares4, b);
const buyShares = 10;
const cost = calculateTradeCost(shares4, 0, buyShares, b);
const sharesAfter = [shares4[0] + buyShares, shares4[1]];
const pricesAfter = calculatePrices(sharesAfter, b);
console.log(`  Before: [${pricesBefore.map((p) => (p * 100).toFixed(2) + "%").join(", ")}]`);
console.log(`  Buy 10 shares of outcome 0 for $${cost.toFixed(2)}`);
console.log(`  After: [${pricesAfter.map((p) => (p * 100).toFixed(2) + "%").join(", ")}]`);
console.log(`  Pass: ${pricesAfter[0] > pricesBefore[0] ? "✓" : "✗"}\n`);

// Test 5: Sell shares moves price down
console.log("Test 5: Selling shares decreases price");
const shares5 = [100, 50];
const pricesBefore5 = calculatePrices(shares5, b);
const sellCost = calculateTradeCost(shares5, 0, -10, b);
const sharesAfter5 = [shares5[0] - 10, shares5[1]];
const pricesAfter5 = calculatePrices(sharesAfter5, b);
console.log(`  Before: [${pricesBefore5.map((p) => (p * 100).toFixed(2) + "%").join(", ")}]`);
console.log(`  Sell 10 shares of outcome 0, receive $${Math.abs(sellCost).toFixed(2)}`);
console.log(`  After: [${pricesAfter5.map((p) => (p * 100).toFixed(2) + "%").join(", ")}]`);
console.log(`  Pass: ${pricesAfter5[0] < pricesBefore5[0] ? "✓" : "✗"}\n`);

// Test 6: Validation
console.log("Test 6: Trade validation");
const shares6 = [50, 50];
const validBuy = validateTrade(shares6, 0, 10, 100, 0, b);
const invalidSell = validateTrade(shares6, 0, -10, 100, 5, b); // Only 5 shares owned
const insufficientFunds = validateTrade(shares6, 0, 200, 10, 0, b); // Only $10 balance
console.log(`  Valid buy: ${validBuy === null ? "✓ Valid" : "✗ " + validBuy}`);
console.log(`  Sell more than owned: ${invalidSell ? "✓ Rejected: " + invalidSell : "✗ Should reject"}`);
console.log(`  Insufficient funds: ${insufficientFunds ? "✓ Rejected: " + insufficientFunds : "✗ Should reject"}`);

console.log("\n=== All Tests Complete ===");
