"""
fetch_historical_ou.py — Fetch historical O/U lines from The Odds API.

Pulls closing O/U lines for each date in the 2025 backtest,
merges with backtest_2025.csv, and outputs backtest_2025_with_ou.csv.

Usage:
    python -m src.fetch_historical_ou
"""

import csv
import os
import json
import time
import requests
from datetime import datetime, timedelta

API_KEY = "00b735f75c5b1d685282b4ed2bddc09c"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "backtest")

# Team name mapping: Odds API full names → backtest abbreviations
TEAM_MAP = {
    "Arizona Diamondbacks": "AZ",
    "Atlanta Braves": "ATL",
    "Baltimore Orioles": "BAL",
    "Boston Red Sox": "BOS",
    "Chicago Cubs": "CHC",
    "Chicago White Sox": "CWS",
    "Cincinnati Reds": "CIN",
    "Cleveland Guardians": "CLE",
    "Colorado Rockies": "COL",
    "Detroit Tigers": "DET",
    "Houston Astros": "HOU",
    "Kansas City Royals": "KC",
    "Los Angeles Angels": "LAA",
    "Los Angeles Dodgers": "LAD",
    "Miami Marlins": "MIA",
    "Milwaukee Brewers": "MIL",
    "Minnesota Twins": "MIN",
    "New York Mets": "NYM",
    "New York Yankees": "NYY",
    "Oakland Athletics": "ATH",
    "Philadelphia Phillies": "PHI",
    "Pittsburgh Pirates": "PIT",
    "San Diego Padres": "SD",
    "San Francisco Giants": "SF",
    "Seattle Mariners": "SEA",
    "St. Louis Cardinals": "STL",
    "Tampa Bay Rays": "TB",
    "Texas Rangers": "TEX",
    "Toronto Blue Jays": "TOR",
    "Washington Nationals": "WSH",
}


def fetch_odds_for_date(date_str):
    """Fetch O/U lines for a single date from The Odds API historical endpoint."""
    # Request odds as of game day at noon ET (16:00 UTC) to get close-to-closing lines
    timestamp = f"{date_str}T16:00:00Z"
    url = (
        f"https://api.the-odds-api.com/v4/historical/sports/baseball_mlb/odds"
        f"?apiKey={API_KEY}&regions=us&markets=h2h,spreads,totals"
        f"&date={timestamp}&bookmakers=draftkings"
    )
    r = requests.get(url)
    if r.status_code != 200:
        print(f"  ERROR {r.status_code} for {date_str}: {r.text[:200]}")
        return {}

    data = r.json()
    remaining = r.headers.get("x-requests-remaining", "?")
    games = data.get("data", [])

    # Parse into lookup: (date, home_abbrev, away_abbrev) -> all odds
    result = {}
    for game in games:
        home_full = game["home_team"]
        away_full = game["away_team"]
        home = TEAM_MAP.get(home_full, home_full)
        away = TEAM_MAP.get(away_full, away_full)
        bookmakers = game.get("bookmakers", [])
        odds = {
            "ou_line": None, "ou_over_odds": None, "ou_under_odds": None,
            "home_ml": None, "away_ml": None,
            "home_spread_point": None, "home_spread_odds": None,
            "away_spread_point": None, "away_spread_odds": None,
        }
        for bk in bookmakers:
            for market in bk.get("markets", []):
                if market["key"] == "totals":
                    for outcome in market.get("outcomes", []):
                        if outcome["name"] == "Over":
                            odds["ou_line"] = outcome.get("point")
                            odds["ou_over_odds"] = outcome.get("price")
                        elif outcome["name"] == "Under":
                            odds["ou_under_odds"] = outcome.get("price")
                elif market["key"] == "h2h":
                    for outcome in market.get("outcomes", []):
                        if outcome["name"] == home_full:
                            odds["home_ml"] = outcome.get("price")
                        elif outcome["name"] == away_full:
                            odds["away_ml"] = outcome.get("price")
                elif market["key"] == "spreads":
                    for outcome in market.get("outcomes", []):
                        if outcome["name"] == home_full:
                            odds["home_spread_point"] = outcome.get("point")
                            odds["home_spread_odds"] = outcome.get("price")
                        elif outcome["name"] == away_full:
                            odds["away_spread_point"] = outcome.get("point")
                            odds["away_spread_odds"] = outcome.get("price")
        if odds["ou_line"] is not None or odds["home_ml"] is not None:
            result[(home, away)] = odds

    print(f"  {date_str}: {len(games)} games, {len(result)} with odds (remaining: {remaining})")
    return result


def run(season=None):
    season = season or 2025
    backtest_csv = os.path.join(DATA_DIR, f"backtest_{season}.csv")
    output_csv = os.path.join(DATA_DIR, f"backtest_{season}_with_ou.csv")
    cache_file = os.path.join(DATA_DIR, f"historical_ou_cache_{season}.json")

    # Load backtest data
    rows = []
    dates = set()
    with open(backtest_csv, newline="") as f:
        for r in csv.DictReader(f):
            rows.append(r)
            dates.add(r["date"])

    dates = sorted(dates)
    print(f"Loaded {len(rows)} games across {len(dates)} dates\n")

    # Load cache if exists
    cache = {}
    if os.path.exists(cache_file):
        with open(cache_file) as f:
            cache = json.load(f)
        print(f"Loaded {len(cache)} cached dates\n")

    # Fetch odds for each date
    all_odds = {}
    for i, date_str in enumerate(dates):
        if date_str in cache:
            # Restore from cache (keys are stored as "HOME|AWAY")
            for key_str, val in cache[date_str].items():
                parts = key_str.split("|")
                all_odds[(date_str, parts[0], parts[1])] = val
            continue

        odds = fetch_odds_for_date(date_str)
        # Store in all_odds with date prefix
        date_cache = {}
        for (home, away), val in odds.items():
            all_odds[(date_str, home, away)] = val
            date_cache[f"{home}|{away}"] = val

        # Save to cache incrementally
        cache[date_str] = date_cache
        if (i + 1) % 10 == 0:
            with open(cache_file, "w") as f:
                json.dump(cache, f)
            print(f"  [cache saved: {i + 1}/{len(dates)} dates]")

        # Small delay to be respectful
        time.sleep(0.2)

    # Final cache save
    with open(cache_file, "w") as f:
        json.dump(cache, f)
    print(f"\nFetched odds for all dates. Cache saved.\n")

    # Merge with backtest data
    matched = 0
    unmatched = 0
    extra_fields = [
        "actual_ou_line", "actual_ou_over_odds", "actual_ou_under_odds",
        "home_ml", "away_ml",
        "home_spread_point", "home_spread_odds", "away_spread_point", "away_spread_odds",
    ]
    fieldnames = list(rows[0].keys()) + extra_fields

    for row in rows:
        date = row["date"]
        # Try to match — backtest uses full team names
        home_full = row.get("home_team", "")
        away_full = row.get("away_team", "")
        home_abbrev = TEAM_MAP.get(home_full, home_full)
        away_abbrev = TEAM_MAP.get(away_full, away_full)

        key = (date, home_abbrev, away_abbrev)
        odds = all_odds.get(key)

        if odds:
            row["actual_ou_line"] = odds.get("ou_line", "")
            row["actual_ou_over_odds"] = odds.get("ou_over_odds", "")
            row["actual_ou_under_odds"] = odds.get("ou_under_odds", "")
            row["home_ml"] = odds.get("home_ml", "")
            row["away_ml"] = odds.get("away_ml", "")
            row["home_spread_point"] = odds.get("home_spread_point", "")
            row["home_spread_odds"] = odds.get("home_spread_odds", "")
            row["away_spread_point"] = odds.get("away_spread_point", "")
            row["away_spread_odds"] = odds.get("away_spread_odds", "")
            matched += 1
        else:
            for f in extra_fields:
                row[f] = ""
            unmatched += 1

    print(f"Matched: {matched}/{len(rows)} ({matched/len(rows)*100:.1f}%)")
    print(f"Unmatched: {unmatched}")

    # Write output
    with open(output_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {output_csv}")


if __name__ == "__main__":
    import sys
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    run(season)
