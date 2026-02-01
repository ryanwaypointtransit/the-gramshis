import Database from "better-sqlite3";

export function createSchema(db: Database.Database) {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      balance REAL DEFAULT 1000.00,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Markets table
    CREATE TABLE IF NOT EXISTS markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'paused', 'resolved')),
      liquidity_param REAL DEFAULT 100,
      winning_outcome_id INTEGER REFERENCES outcomes(id),
      resolved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Outcomes table
    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      shares_outstanding REAL DEFAULT 0,
      display_order INTEGER DEFAULT 0
    );

    -- Positions table (user holdings)
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
      shares REAL DEFAULT 0,
      avg_cost_basis REAL DEFAULT 0,
      UNIQUE(user_id, outcome_id)
    );

    -- Transactions table (trade history)
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      outcome_id INTEGER NOT NULL REFERENCES outcomes(id),
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
      shares REAL NOT NULL,
      price_per_share REAL NOT NULL,
      total_cost REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Admin logs table
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_outcomes_market ON outcomes(market_id);
    CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
    CREATE INDEX IF NOT EXISTS idx_positions_outcome ON positions(outcome_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_outcome ON transactions(outcome_id);
  `);
}
