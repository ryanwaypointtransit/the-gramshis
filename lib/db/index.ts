import Database from "better-sqlite3";
import path from "path";
import { createSchema } from "./schema";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "gramshis.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    createSchema(db);
  }
  return db;
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
  type: "buy" | "sell";
  shares: number;
  price_per_share: number;
  total_cost: number;
  balance_before: number;
  balance_after: number;
  created_at: string;
}
