# 🚗 Dealeros — Car Dealership Management System

> **📌 Note:** In the Excel `Master_Spreadsheet`, the **Stock Data** table requires you to scroll down to view all records. This is expected behavior due to the header structure.

> **⚠️ Disclaimer:** This project was built under significant time constraints. Every feature below represents the maximum achievable within the given timeframe — all core systems are functional and production-ready.

---

![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Excel](https://img.shields.io/badge/Sync-Excel%20%2F%20ExcelJS-217346?style=flat-square&logo=microsoft-excel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## 📖 Overview

**Dealeros** is a full-stack car dealership management system built with **Node.js**, **SQLite**, and a **Vanilla JS** frontend.

It replaces temporary browser-based storage (`localStorage`) with a reliable relational database, and introduces real file system integration, two-way Excel synchronization, and complete business logic for stock management, sales, investor tracking, and operations.

---

## ✨ Features

### 🗄️ Database & Architecture (SQLite)

- All data — cars, viewings, logistics, fines, and expenses — is stored in a persistent SQLite database (`dealeros.db`), fully replacing `localStorage`
- The `cars` table was extended with `date_sold` for accurate sales tracking and SOR fields (`is_sor`, `sor_owner`)
- New tables added: `viewings`, `fines`, and `movements`

---

### 📂 File System Integration (Mac / Windows)

- Adding a new vehicle automatically generates a `Cars/STK-XXXXXX/` folder with **8 subfolders** (Photos, Documents, Sale, Purchase, etc.)
- Investor directories are auto-created under `Investors/[Name]/Invoices`, `Contracts`, `Payouts`
- Generating an invoice saves a real `.html` file to both the car's `Sale/` folder and the investor's `Invoices/` folder simultaneously

---

### 📊 Two-Way Excel Sync — *"Bulletproof Sync"*

- A smart `parseCustomDate` algorithm handles **all date formats**:
  - Standard: `YYYY-MM-DD`
  - British: `DD/MM/YYYY`
  - Raw Excel serial numbers (e.g. `45800`)
- This permanently fixed the empty column bug and the `0d` days-in-stock issue
- Background auto-sync (`autoSyncExcel`) rewrites the `Stock Data` and `Sold Stock` tabs in `Master_Spreadsheet.xlsx` after **every action**, using cell-level writes to preserve original formatting — no manual export needed

---

### 💼 Business Logic & Finance

| Feature | Description |
|---|---|
| **SOR Module** | Vehicles on commission are flagged `is_sor`; cost is set to `0` on sale and owner name is displayed |
| **Days in Stock** | Calculated dynamically from today for active cars, from `date_sold` for sold ones |
| **Investor Ledger** | Fixed critical SQL bug — "Total Invested" now correctly sums `total_cost` including repair costs |

---

### ⚙️ Backend & API (`server.js`)

- Centralized **STK-XXXXXX** ID generator used as the primary key across the entire system
- **10+ new API routes**, including:
POST /api/cars → Add vehicle + create folders + trigger sync
POST /api/cars/sell → Mark as sold + update status + sync Excel
POST /api/invoice/save → Write invoice HTML file to disk
GET /api/viewings → Fetch all viewings
POST /api/viewings → Log new viewing
GET /api/fines → Fetch all fines
POST /api/fines → Log new fine
GET /api/movements → Fetch all logistics/collections
POST /api/movements → Log new movement

---

### 💻 Frontend & UI

- `fetchRealStockData()` and `fetchOperationsData()` load fresh data from the database on every page load
- Dashboard charts, **Top Profit Cars**, and counters only render after real server data is received — fixing the hardcoded *"29 In Stock"* display bug
- All modal forms *(Log Expense, Add Vehicle, Add Collection, etc.)* are wired to real API calls and **auto-clear on success**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | SQLite (`better-sqlite3`) |
| Excel Integration | `exceljs` |
| Frontend | HTML, CSS, Vanilla JavaScript |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start the server
node server.js
```

Then open your browser at:

http://localhost:3000


---

*Built with maximum effort within the given time constraints.*

