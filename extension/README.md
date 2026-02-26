# Lucid Trading Stats – Browser Extension

Adds an **improved trading stats** panel to the Lucid Trading dashboard (Account Details page): win rate, profit factor, expectancy, and more, with optional views **by asset** and **by day of week**.

## Features

- **Win rate** – % of trades that are profitable  
- **Profit factor** – gross profit ÷ gross loss  
- **Net P&L**, **gross profit**, **gross loss**  
- **Expectancy** – expected $ per trade  
- **Avg win / avg loss**, **largest win / largest loss**  
- **Wins / losses** – count of winning vs losing trades  
- **By asset** – same stats filtered by symbol (e.g. MGCJ6, MNQH6)  
- **By day** – same stats filtered by day of week (Mon–Sun)  

The panel is injected above the equity chart on the Account Details page and uses the same dark theme and card styling as the rest of the dashboard.

## Install (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder (the one containing `manifest.json`).

## Usage

1. Go to [Lucid Trading Dashboard](https://dash.lucidtrading.com) and open **Account Details** for an account.
2. Wait for the Trading History table to load.
3. The **Trading stats** panel appears above the chart. Use **All** / **By asset** / **By day** to switch views; use the dropdown when in By asset or By day to pick symbol or day.

## How it works

The extension runs only on `dash.lucidtrading.com` (and `*.lucidtrading.com`). It finds the Trading History table on the page, parses each row (Date, Symbol, Net PnL, Win %, etc.), and computes the stats from that data. No data is sent elsewhere; everything runs in the page.

## Files

- `manifest.json` – Extension manifest (Manifest V3).
- `content.js` – Parses the table, computes stats, injects the panel and view toggles.
- `styles.css` – Styles aligned with the Lucid dashboard (dark background, green/red for PnL, same card look).

You can tweak `styles.css` later to match any design changes on the main site.
