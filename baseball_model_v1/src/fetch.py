"""
fetch.py — Data fetching module.

Pulls data from Statcast (pybaseball), MLB Stats API, The Odds API,
and OpenWeatherMap. All external I/O lives here.
"""

import os
import json
import logging
from datetime import datetime, timedelta

import requests
import statsapi
import pandas as pd
from pybaseball import statcast_pitcher, statcast_batter, fg_park_factors
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("pipeline")

ODDS_API_KEY = os.getenv("ODDS_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
CURRENT_SEASON = int(os.getenv("CURRENT_SEASON", datetime.now().year))

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


# ---------------------------------------------------------------------------
# MLB Stats API helpers
# ---------------------------------------------------------------------------

def fetch_schedule(date_str: str) -> list[dict]:
    """Return list of games for a given date (YYYY-MM-DD).

    Each dict has keys: game_id, home_team, away_team, home_starter_id,
    away_starter_id, game_time, venue.
    """
    try:
        sched = statsapi.schedule(date=date_str)
    except Exception as e:
        logger.error("[ALERT] MLB Stats API unavailable — %s", e)
        raise RuntimeError(
            f"[ALERT] MLB Stats API unavailable — pipeline cannot continue "
            f"without lineup and starter data. Error: {e}"
        )

    games = []
    for g in sched:
        game = {
            "game_id": str(g["game_id"]),
            "home_team": g.get("home_name", ""),
            "away_team": g.get("away_name", ""),
            "home_abbrev": g.get("home_short", g.get("home_name", "")),
            "away_abbrev": g.get("away_short", g.get("away_name", "")),
            "home_starter_id": None,
            "away_starter_id": None,
            "home_starter_name": g.get("home_probable_pitcher", "TBD"),
            "away_starter_name": g.get("away_probable_pitcher", "TBD"),
            "game_time": g.get("game_datetime", ""),
            "venue": g.get("venue_name", ""),
            "status": g.get("status", ""),
        }
        # Extract pitcher IDs from the schedule data
        if g.get("home_pitcher_note"):
            game["home_starter_id"] = _extract_pitcher_id(g, "home")
        if g.get("away_pitcher_note"):
            game["away_starter_id"] = _extract_pitcher_id(g, "away")
        games.append(game)
    return games


def _extract_pitcher_id(game_data: dict, side: str) -> str | None:
    """Try to extract pitcher player ID from schedule data."""
    try:
        game_detail = statsapi.get(
            "game", {"gamePk": game_data["game_id"]}
        )
        teams = game_detail.get("gameData", {}).get("probablePitchers", {})
        pitcher = teams.get(side, {})
        return str(pitcher.get("id", "")) if pitcher else None
    except Exception:
        return None


def fetch_lineup(game_id: str) -> dict:
    """Fetch confirmed lineups for a game.

    Returns dict with keys: home_lineup, away_lineup (lists of batter ID strings),
    home_lineup_confirmed, away_lineup_confirmed.
    """
    result = {
        "home_lineup": [],
        "away_lineup": [],
        "home_lineup_confirmed": False,
        "away_lineup_confirmed": False,
    }
    try:
        boxscore = statsapi.boxscore_data(game_id)
        for side in ("home", "away"):
            batters = boxscore.get(f"{side}Batters", [])
            # First entry is often the header row; filter to real player IDs
            lineup = []
            for b in batters:
                if isinstance(b, int) and b > 0:
                    lineup.append(str(b))
                elif isinstance(b, dict) and b.get("personId"):
                    lineup.append(str(b["personId"]))
            result[f"{side}_lineup"] = lineup[:9]
            result[f"{side}_lineup_confirmed"] = len(lineup) >= 9
    except Exception as e:
        logger.warning("[ALERT] Could not fetch lineup for game %s — %s", game_id, e)
    return result


def fetch_probable_starters(date_str: str) -> dict[str, dict]:
    """Return dict mapping game_id -> {home_starter_id, away_starter_id, confirmed}."""
    schedule = fetch_schedule(date_str)
    starters = {}
    for g in schedule:
        starters[g["game_id"]] = {
            "home_starter_id": g.get("home_starter_id"),
            "away_starter_id": g.get("away_starter_id"),
            "home_starter_name": g.get("home_starter_name", "TBD"),
            "away_starter_name": g.get("away_starter_name", "TBD"),
            "starter_confirmed": g.get("status", "") in ("Final", "In Progress", "Pre-Game"),
        }
    return starters


# ---------------------------------------------------------------------------
# Statcast (pybaseball)
# ---------------------------------------------------------------------------

def fetch_statcast_pitcher(pitcher_id: int, start_dt: str, end_dt: str) -> pd.DataFrame | None:
    """Fetch raw pitch-level Statcast data for a pitcher."""
    try:
        df = statcast_pitcher(start_dt, end_dt, pitcher_id)
        if df is not None and not df.empty:
            return df
        logger.warning(
            "[ALERT] No Statcast data for pitcher %s (%s to %s)",
            pitcher_id, start_dt, end_dt,
        )
        return None
    except Exception as e:
        logger.error("[ALERT] Statcast pull failed for pitcher %s — %s", pitcher_id, e)
        return None


def fetch_statcast_batter(batter_id: int, start_dt: str, end_dt: str) -> pd.DataFrame | None:
    """Fetch raw pitch-level Statcast data for a batter."""
    try:
        df = statcast_batter(start_dt, end_dt, batter_id)
        if df is not None and not df.empty:
            return df
        logger.warning(
            "[ALERT] No Statcast data for batter %s (%s to %s)",
            batter_id, start_dt, end_dt,
        )
        return None
    except Exception as e:
        logger.error("[ALERT] Statcast pull failed for batter %s — %s", batter_id, e)
        return None


# ---------------------------------------------------------------------------
# Park Factors
# ---------------------------------------------------------------------------

def fetch_park_factors(season: int | None = None) -> dict:
    """Fetch FanGraphs park factors and cache to data/park_factors.json.

    Returns dict mapping team abbreviation -> park factor (decimal, 1.0 = neutral).
    """
    season = season or CURRENT_SEASON
    cache_path = os.path.join(DATA_DIR, "park_factors.json")

    # Use cache if it exists and is from this season
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            cached = json.load(f)
        if cached.get("season") == season:
            return cached.get("factors", {})

    try:
        df = fg_park_factors(season)
        factors = {}
        for _, row in df.iterrows():
            team = row.get("Team", row.get("team", ""))
            basic = row.get("Basic", row.get("basic", 100))
            factors[team] = round(int(basic) / 100, 3)

        payload = {"season": season, "factors": factors}
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "w") as f:
            json.dump(payload, f, indent=2)
        return factors
    except Exception as e:
        logger.error("[ALERT] Park factors fetch failed — %s", e)
        if os.path.exists(cache_path):
            with open(cache_path) as f:
                return json.load(f).get("factors", {})
        return {}


# ---------------------------------------------------------------------------
# Odds API
# ---------------------------------------------------------------------------

def fetch_odds(sport: str = "baseball_mlb") -> list[dict]:
    """Fetch current odds for all MLB games from The Odds API.

    Returns list of game odds dicts with moneyline, spread, and totals.
    Fetches h2h, spreads, and totals in a single API call to conserve quota.
    """
    if not ODDS_API_KEY or ODDS_API_KEY == "your_key_here":
        logger.error(
            "[ALERT] Odds API key not configured — value edge check "
            "skipped for all games. Edge score signals shown without value confirmation."
        )
        return []

    url = f"https://api.the-odds-api.com/v4/sports/{sport}/odds"
    params = {
        "apiKey": ODDS_API_KEY,
        "regions": "us",
        "markets": "h2h,spreads,totals",
        "oddsFormat": "american",
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return _parse_odds_response(resp.json())
    except Exception as e:
        logger.error(
            "[ALERT] Odds API unavailable — value edge check skipped for "
            "all games. Edge score signals shown without value confirmation. Error: %s",
            e,
        )
        return []


def _parse_odds_response(data: list[dict]) -> list[dict]:
    """Parse Odds API response into simplified game-level odds dicts."""
    results = []
    for game in data:
        parsed = {
            "odds_game_id": game.get("id"),
            "home_team": game.get("home_team", ""),
            "away_team": game.get("away_team", ""),
            "commence_time": game.get("commence_time", ""),
            "home_moneyline": None,
            "away_moneyline": None,
            "home_run_line": None,
            "away_run_line": None,
            "ou_line": None,
            "ou_over_odds": None,
            "ou_under_odds": None,
        }
        # Use first available bookmaker
        for bookmaker in game.get("bookmakers", []):
            for market in bookmaker.get("markets", []):
                key = market["key"]
                outcomes = {o["name"]: o for o in market.get("outcomes", [])}

                if key == "h2h":
                    home = outcomes.get(game.get("home_team", ""), {})
                    away = outcomes.get(game.get("away_team", ""), {})
                    if parsed["home_moneyline"] is None:
                        parsed["home_moneyline"] = home.get("price")
                        parsed["away_moneyline"] = away.get("price")

                elif key == "spreads":
                    home = outcomes.get(game.get("home_team", ""), {})
                    away = outcomes.get(game.get("away_team", ""), {})
                    if parsed["home_run_line"] is None:
                        parsed["home_run_line"] = home.get("price")
                        parsed["away_run_line"] = away.get("price")

                elif key == "totals":
                    over = outcomes.get("Over", {})
                    under = outcomes.get("Under", {})
                    if parsed["ou_line"] is None:
                        parsed["ou_line"] = over.get("point")
                        parsed["ou_over_odds"] = over.get("price")
                        parsed["ou_under_odds"] = under.get("price")

            # Stop after first bookmaker with data
            if parsed["home_moneyline"] is not None:
                break

        results.append(parsed)
    return results


# ---------------------------------------------------------------------------
# Bullpen game logs (recent workload)
# ---------------------------------------------------------------------------

def fetch_team_game_logs(team_id: int, days: int = 3) -> list[dict]:
    """Fetch recent game logs for a team to calculate reliever workload."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    try:
        games = statsapi.schedule(
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
            team=team_id,
        )
        return games
    except Exception as e:
        logger.warning("[ALERT] Could not fetch game logs for team %s — %s", team_id, e)
        return []


def fetch_reliever_workload(team_abbrev: str, days: int = 3) -> float:
    """Calculate total reliever innings pitched in the last N days.

    Returns total IP as a float.
    """
    try:
        # Look up team ID
        teams = statsapi.lookup_team(team_abbrev)
        if not teams:
            return 0.0
        team_id = teams[0]["id"]

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        games = statsapi.schedule(
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
            team=team_id,
        )

        total_reliever_ip = 0.0
        for game in games:
            if game.get("status") != "Final":
                continue
            try:
                box = statsapi.boxscore_data(game["game_id"])
                side = "home" if game.get("home_id") == team_id else "away"
                pitchers = box.get(f"{side}Pitchers", [])
                # Skip first pitcher (starter) — rest are relievers
                for i, p in enumerate(pitchers):
                    if i == 0:
                        continue
                    if isinstance(p, dict):
                        ip_str = p.get("ip", "0")
                        total_reliever_ip += _parse_ip(ip_str)
            except Exception:
                continue
        return total_reliever_ip
    except Exception as e:
        logger.warning("[ALERT] Reliever workload fetch failed for %s — %s", team_abbrev, e)
        return 0.0


def _parse_ip(ip_str: str) -> float:
    """Parse innings pitched string (e.g. '6.1' = 6⅓) to float."""
    try:
        parts = str(ip_str).split(".")
        innings = int(parts[0])
        thirds = int(parts[1]) if len(parts) > 1 else 0
        return innings + thirds / 3.0
    except (ValueError, IndexError):
        return 0.0


# ---------------------------------------------------------------------------
# Proxy lineup (fallback when lineups not posted)
# ---------------------------------------------------------------------------

def fetch_proxy_lineup(team_abbrev: str, num_batters: int = 9) -> list[str]:
    """Get top batters by recent PA for a team as a proxy lineup.

    Used when official lineups are not yet posted.
    """
    try:
        teams = statsapi.lookup_team(team_abbrev)
        if not teams:
            return []
        team_id = teams[0]["id"]
        roster = statsapi.roster(team_id, rosterType="active")

        # Parse roster text to get player names/IDs
        player_ids = []
        for line in roster.split("\n"):
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 3:
                # Roster format: "#NN Name Position"
                # Try to find player and get ID
                try:
                    name = " ".join(parts[1:-1])
                    lookup = statsapi.lookup_player(name)
                    if lookup:
                        pid = lookup[0]["id"]
                        pos = parts[-1]
                        if pos not in ("P", "SP", "RP", "CL"):
                            player_ids.append(str(pid))
                except Exception:
                    continue
        return player_ids[:num_batters]
    except Exception as e:
        logger.warning("[ALERT] Proxy lineup failed for %s — %s", team_abbrev, e)
        return []


# ---------------------------------------------------------------------------
# Caching helpers
# ---------------------------------------------------------------------------

def load_cached_profile(profile_type: str, player_id: str) -> dict | None:
    """Load a cached profile from disk. profile_type is 'pitchers' or 'batters'."""
    path = os.path.join(DATA_DIR, profile_type, f"{player_id}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None


def save_cached_profile(profile_type: str, player_id: str, profile: dict) -> None:
    """Save a profile to disk cache."""
    dir_path = os.path.join(DATA_DIR, profile_type)
    os.makedirs(dir_path, exist_ok=True)
    path = os.path.join(dir_path, f"{player_id}.json")
    with open(path, "w") as f:
        json.dump(profile, f, indent=2)


def save_game_record(date_str: str, games: list[dict]) -> None:
    """Save daily game records to data/games/{date}.json."""
    dir_path = os.path.join(DATA_DIR, "games")
    os.makedirs(dir_path, exist_ok=True)
    path = os.path.join(dir_path, f"{date_str}.json")
    with open(path, "w") as f:
        json.dump(games, f, indent=2)


def load_game_record(date_str: str) -> list[dict] | None:
    """Load game records for a date."""
    path = os.path.join(DATA_DIR, "games", f"{date_str}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None
