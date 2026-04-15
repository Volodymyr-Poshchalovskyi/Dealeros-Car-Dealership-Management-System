// database.js
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const path = require("path");

// Define the path for the SQLite database file
const dbPath = path.resolve(__dirname, "dealeros.db");

async function setupDatabase() {
  // Open the database connection
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create tables based on the Excel structure
  await db.exec(`
        -- Main Stock Table
        CREATE TABLE IF NOT EXISTS cars (
            stock_id TEXT PRIMARY KEY,
            date_acquired TEXT,
            date_sold TEXT,
            plate_number TEXT,
            make_model TEXT,
            source TEXT,
            is_sor BOOLEAN DEFAULT 0,
        sor_owner TEXT,
            px_value REAL DEFAULT 0,
            purchase_price REAL DEFAULT 0,
            reconditioning_costs REAL DEFAULT 0,
            total_cost REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            status TEXT DEFAULT 'In Stock',
            investor TEXT,
            notes TEXT
        );

        -- Viewings table
        CREATE TABLE IF NOT EXISTS viewings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT, phone TEXT, vehicle TEXT, 
            viewing_date TEXT, viewing_time TEXT,
            source TEXT, finance TEXT, delivery TEXT, 
            notes TEXT, status TEXT DEFAULT 'Booked', outcome TEXT
        );

        -- Fines table
        CREATE TABLE IF NOT EXISTS fines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate TEXT, type TEXT, date_issued TEXT, 
            amount REAL, due_date TEXT, reference TEXT, 
            notes TEXT, status TEXT DEFAULT 'Unpaid'
        );

        -- Logistics movements table
        CREATE TABLE IF NOT EXISTS movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT, plate TEXT, model TEXT, 
            date_won TEXT, scheduled_date TEXT, driver TEXT, 
            address TEXT, cost REAL, status TEXT, 
            notes TEXT, linked_vehicles TEXT
        );

        -- Company & Car Expenses Table
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stock_id TEXT,
            month TEXT,
            expense_date TEXT,
            category TEXT,
            payee TEXT,
            amount REAL DEFAULT 0,
            payment_method TEXT,
            paid_by TEXT,
            notes TEXT,
            FOREIGN KEY(stock_id) REFERENCES cars(stock_id)
        );

        -- Investors Balance Table
        CREATE TABLE IF NOT EXISTS investors (
            name TEXT PRIMARY KEY,
            initial_balance REAL DEFAULT 0,
            capital_returned REAL DEFAULT 0,
            total_balance REAL DEFAULT 0,
            purchased REAL DEFAULT 0,
            total_profit REAL DEFAULT 0,
            available REAL DEFAULT 0
        );

        -- Logistics & Collections Table
        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            date_won TEXT,
            plate_number TEXT,
            make_model TEXT,
            location TEXT,
            post_code TEXT,
            collection_date TEXT,
            notes TEXT
        );
    `);

  return db;
}

module.exports = setupDatabase;
