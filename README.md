# <h1 style="color:red">> Frontend In Development</h1>

# Portfolio Management System

A Node.js backend for tracking financial asset portfolios with hierarchical grouping, FIFO accounting, and NAV-based performance measurement.

## What This Actually Does

This is a personal finance tracking system that manages investments across stocks, mutual funds, ETFs, bonds, and indices. It handles buy/sell/dividend transactions, calculates capital gains using FIFO, tracks NAV performance, and syncs prices from Google Sheets.

## Core Components

### Asset Management

- **Classification System**: 5-tier hierarchy (Class > Category > Subcategory > Index Name > Asset)
- **Metadata Storage**: ISIN codes, ticker symbols (NSE/BSE), currency, sector/industry/AMC mappings
- **Price History**: Daily OHLC data fetched from Google Sheets via Apps Script
- **Validation**: Schema-based validation with required/forbidden fields per asset class
- **In-Memory Cache**: Asset classifications and metadata cached on startup for fast lookups

### Portfolio Structure

- **Hierarchical Groups**: Tree structure with 4 max levels (root > level 2 > level 3 > leaf)
- **Leaf-Only Transactions**: Trading only allowed on leaf nodes
- **Consolidated Metrics**: Cash, current value, tax roll up to parents
- **Soft Delete**: Groups marked deleted, not destroyed

### Transaction Engine

- **Trade Types**: Buy, sell, dividend
- **FIFO Lot Tracking**: Cost basis tracked per purchase lot, oldest sold first
- **Capital Gains**: STCG (<365 days), LTCG (>365 days) calculated automatically
- **Locking Mechanism**: Per-asset and per-group locks prevent concurrent modification (1 min timeout)
- **Backdating Prevention**: Transactions must be newer than last ledger entry
- **NAV Gap Filling**: Missing NAV entries backfilled before new transactions

### NAV System

- **Unit-Based Accounting**: Deposits/withdrawals change units at current NAV
- **Market Updates**: Price changes modify NAV while units stay constant
- **Tax Treatment**: Reduces value without changing units
- **Daily Snapshots**: NAV calculated and stored daily
- **Bottom-Up Propagation**: Leaf values aggregate to parents

### Financial Snapshots

- **Current Position**: Total quantity, investment value, current value
- **Lifetime Metrics**: Realized gains, dividends (cumulative)
- **Financial Year**: Realized gains, dividends, unrealized gains, total gains (April 1 start)
- **IRR Placeholder**: Field exists but not calculated

## Technical Stack

**Runtime**: Node.js + Express
**Database**: MongoDB (Mongoose ODM)
**Auth**: Passport.js with local strategy + express-session
**Validation**: Joi schemas
**External Integration**: Google Apps Script (price data source)
**Session Store**: MongoDB via connect-mongo

## Data Models

### Asset Classification

```
AssetClass (INDEX, ETF, MUTUAL FUND, BOND, STOCK)
  └─ AssetCategory
      └─ AssetSubCategory
          └─ AssetIndexName (optional)

AssetSector
  └─ AssetIndustry

AssetAMC (standalone)
```

### Portfolio Hierarchy

```
PortfolioGroup (level 1, root)
  └─ PortfolioGroup (level 2)
      └─ PortfolioGroup (level 3)
          └─ PortfolioGroup (level 4, leaf)
              └─ FinancialAsset
                  └─ FifoLot (multiple)
```

### Transaction Ledgers

- **LedgerStatement**: Buy/sell/dividend transactions per asset
- **GroupStatement**: Deposit/withdrawal/tax transactions per group
- **FifoLot**: Individual purchase lots with remaining quantity
- **NavPerformance**: Daily NAV snapshots per group

## API Routes

### User Routes (`/`)

- `POST /signup` - Register new user (creates default root portfolio group)
- `POST /login` - Authenticate user
- `GET /logout` - End session
- `GET /islogedin` - Check auth status

### Admin Routes (`/admin/dataseeders`)

- `POST /seedclassification` - Update asset classification tree from Google Sheets
- `POST /seedassetmetadata` - Update asset metadata from Google Sheets
- `POST /seedpricehistory` - Insert historical prices for specific asset

### Portfolio Routes (`/portfolio`)

- `POST /:pg_id` - Create child group
- `PATCH /:pg_id` - Update group name/description
- `DELETE /:pg_id` - Soft delete group and descendants
- `POST /:pg_id/grouptransaction` - Deposit/withdrawal/tax transaction
- `POST /:pg_id/trade/:a_id` - Execute buy/sell/dividend trade

## Workflow: Trade Execution

1. **Validation**: Check transaction type, amounts, leaf node, ownership
2. **Lock Acquisition**: Prevent concurrent trades on same asset
3. **Backdating Check**: Ensure transaction is newer than last entry
4. **NAV Gap Fill**: Backfill missing NAV entries from last transaction to new date
5. **Trade Logic**:
   - **Buy**: Create FIFO lot, deduct cash, increment quantity
   - **Sell**: Consume oldest lots, calculate STCG/LTCG, add cash, decrement quantity
   - **Dividend**: Add cash, record as income
6. **Ledger Entry**: Record transaction in LedgerStatement
7. **Balance Updates**: Update cash and metrics across group hierarchy
8. **NAV Upsert**: Update NAV for all affected groups
9. **Lock Release**: Free asset for next transaction
10. **Future NAV Sync**: Propagate changes to all dates after transaction
11. **Portfolio Sync**: Recalculate current snapshots for all groups

## Bootstrap Sequence (server.js)

1. **DB Connection**: Connect to MongoDB
2. **Cache Init**: Load asset classifications and metadata into memory (with retry logic)
3. **Apps Script Init**: Initialize price ticker and fetch past prices
4. **NAV Update**: For each user, backfill NAV from last entry to current date (batched, retried)
5. **Scheduled Jobs**:
   - Every 3 minutes: Fetch current prices from Google Sheets
   - Every 4 minutes: Sync NAV and portfolio snapshots for all users

## Configuration

Environment variables required:

```
NODE_ENV
DB_URL
SESSION_SECRET
APPSCRIPT_SEEDER_URL
APPSCRIPT_SEEDER_API_KEY
```

## CORS Policy

```javascript
origin: localhost:5173 or 192.168.x.x
credentials: true
```

## Installation

```bash
npm install
# Set environment variables
node server.js
```
