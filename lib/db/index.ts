import { neon } from "@neondatabase/serverless";

// Create a function that returns the neon query function
// This avoids errors at build time when DATABASE_URL is not set
export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(databaseUrl);
}

// For convenience, export sql as an alias that creates the connection on first use
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cachedSql: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  if (!_cachedSql) {
    _cachedSql = getDb();
  }
  const result = await _cachedSql(strings, ...values);
  return result;
}

// Initialize the database schema
export async function initDb() {
  const db = getDb();
  
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      balance DECIMAL(10,2) DEFAULT 1000.00,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS markets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'paused', 'resolved')),
      liquidity_param DECIMAL(10,2) DEFAULT 100,
      winning_outcome_id INTEGER,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS outcomes (
      id SERIAL PRIMARY KEY,
      market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      shares_outstanding DECIMAL(10,4) DEFAULT 0,
      display_order INTEGER DEFAULT 0
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS positions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
      shares DECIMAL(10,4) DEFAULT 0,
      avg_cost_basis DECIMAL(10,4) DEFAULT 0,
      UNIQUE(user_id, outcome_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'payout')),
      shares DECIMAL(10,4) NOT NULL,
      price_per_share DECIMAL(10,4) NOT NULL,
      total_cost DECIMAL(10,2) NOT NULL,
      balance_before DECIMAL(10,2) NOT NULL,
      balance_after DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      admin_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create indexes
  try {
    await db`CREATE INDEX IF NOT EXISTS idx_outcomes_market ON outcomes(market_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_positions_outcome ON positions(outcome_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_transactions_outcome ON transactions(outcome_id)`;
  } catch {
    // Indexes might already exist
  }
}

// Type definitions for database rows
export interface User {
  id: number;
  name: string;
  display_name: string;
  balance: number;
  is_admin: number;
  created_at: string;
}

export interface Market {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "open" | "paused" | "resolved";
  liquidity_param: number;
  winning_outcome_id: number | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Outcome {
  id: number;
  market_id: number;
  name: string;
  shares_outstanding: number;
  display_order: number;
}

export interface Position {
  id: number;
  user_id: number;
  outcome_id: number;
  shares: number;
  avg_cost_basis: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  outcome_id: number;
  type: "buy" | "sell" | "payout";
  shares: number;
  price_per_share: number;
  total_cost: number;
  balance_before: number;
  balance_after: number;
  created_at: string;
}
