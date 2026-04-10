"""
threshold_sweep.py — Sweep ML, DIFF, and RL thresholds using pre-computed data.

Uses the new component weights (30/35/15/20) to reconstruct edge scores,
then tests every threshold combination to find the best accuracy/volume
tradeoff.

Usage:
    py -3 -m src.threshold_sweep
"""

import csv
import os
import sys
from collections import defaultdict

BACKTEST_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "backtest")

HOME_FIELD_ADJ = 3

# New tuned weights
ZONE_W, PITCH_W, WALK_W, HAND_W = 49, 22, 19, 10
ORIG_ZONE, ORIG_PITCH, ORIG_WALK, ORIG_HAND = 40, 30, 15, 15


def load_games(season: int) -> list:
    path = os.path.join(BACKTEST_DIR, f"backtest_{season}.csv")
    games = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if "home_zone" not in row:
                print("ERROR: backtest CSV missing component scores.")
                sys.exit(1)
            for key in ("home_zone", "home_pitch", "home_walk", "home_hand",
                        "away_zone", "away_pitch", "away_walk", "away_hand",
                        "park_factor", "park_weather_adj",
                        "home_bp_mod", "away_bp_mod",
                        "home_bullpen_score", "away_bullpen_score",
                        "home_score", "away_score"):
                row[key] = float(row.get(key) or 0)
            row["home_won"] = row["home_score"] > row["away_score"]
            row["margin"] = abs(row["home_score"] - row["away_score"])
            games.append(row)
    return games


def apply_park_factor(raw_score: float, park_factor: float) -> float:
    adj = raw_score * (1 + (1.0 - park_factor) * 0.5)
    adjustment = max(-10, min(10, adj - raw_score))
    return round(raw_score + adjustment, 2)


def get_edges(game: dict) -> dict:
    zm = ZONE_W / ORIG_ZONE
    pm = PITCH_W / ORIG_PITCH
    wm = WALK_W / ORIG_WALK
    hm = HAND_W / ORIG_HAND

    home_raw = max(0, min(100,
        game["home_zone"] * zm + game["home_pitch"] * pm +
        game["home_walk"] * wm + game["home_hand"] * hm))
    away_raw = max(0, min(100,
        game["away_zone"] * zm + game["away_pitch"] * pm +
        game["away_walk"] * wm + game["away_hand"] * hm))

    home_park = apply_park_factor(home_raw, game["park_factor"])
    away_park = apply_park_factor(away_raw, game["park_factor"])

    home_final = round(home_park + game["park_weather_adj"] + game["home_bp_mod"] + HOME_FIELD_ADJ, 2)
    away_final = round(away_park + game["park_weather_adj"] + game["away_bp_mod"], 2)

    return {"home": home_final, "away": away_final}


def precompute_edges(games: list) -> list:
    """Pre-compute edges once for all games."""
    results = []
    for g in games:
        edges = get_edges(g)
        results.append({
            "home_edge": edges["home"],
            "away_edge": edges["away"],
            "max_edge": max(edges["home"], edges["away"]),
            "diff": abs(edges["home"] - edges["away"]),
            "favored_home": edges["home"] > edges["away"],
            "home_won": g["home_won"],
            "margin": g["margin"],
        })
    return results


def sweep_ml(games: list, thresholds: range) -> list:
    """Sweep ML threshold."""
    results = []
    for t in thresholds:
        total = wins = 0
        for g in games:
            if g["max_edge"] >= t:
                total += 1
                if g["favored_home"] and g["home_won"]:
                    wins += 1
                elif not g["favored_home"] and not g["home_won"]:
                    wins += 1
        wr = round(wins / total * 100, 1) if total else 0
        results.append({"threshold": t, "games": total, "wins": wins, "win_rate": wr})
    return results


def sweep_diff(games: list, thresholds: range) -> list:
    """Sweep DIFF threshold."""
    results = []
    for t in thresholds:
        total = wins = 0
        for g in games:
            if g["diff"] >= t:
                total += 1
                if g["favored_home"] and g["home_won"]:
                    wins += 1
                elif not g["favored_home"] and not g["home_won"]:
                    wins += 1
        wr = round(wins / total * 100, 1) if total else 0
        results.append({"threshold": t, "games": total, "wins": wins, "win_rate": wr})
    return results


def sweep_rl(games: list, thresholds: range) -> list:
    """Sweep RL threshold (win by 2+)."""
    results = []
    for t in thresholds:
        total = win_by_2 = 0
        for g in games:
            if g["max_edge"] >= t:
                total += 1
                if g["favored_home"] and g["home_won"] and g["margin"] >= 2:
                    win_by_2 += 1
                elif not g["favored_home"] and not g["home_won"] and g["margin"] >= 2:
                    win_by_2 += 1
        wr = round(win_by_2 / total * 100, 1) if total else 0
        results.append({"threshold": t, "games": total, "win_by_2": win_by_2, "win_rate": wr})
    return results


def sweep_combined(games: list, ml_range: range, diff_range: range) -> list:
    """Sweep ML + DIFF together — DIFF only fires when ML doesn't."""
    results = []
    for ml_t in ml_range:
        for diff_t in diff_range:
            ml_total = ml_wins = 0
            diff_total = diff_wins = 0
            for g in games:
                ml_fired = g["max_edge"] >= ml_t
                if ml_fired:
                    ml_total += 1
                    if g["favored_home"] and g["home_won"]:
                        ml_wins += 1
                    elif not g["favored_home"] and not g["home_won"]:
                        ml_wins += 1
                elif g["diff"] >= diff_t:
                    diff_total += 1
                    if g["favored_home"] and g["home_won"]:
                        diff_wins += 1
                    elif not g["favored_home"] and not g["home_won"]:
                        diff_wins += 1

            ml_wr = round(ml_wins / ml_total * 100, 1) if ml_total else 0
            diff_wr = round(diff_wins / diff_total * 100, 1) if diff_total else 0
            combined_total = ml_total + diff_total
            combined_wins = ml_wins + diff_wins
            combined_wr = round(combined_wins / combined_total * 100, 1) if combined_total else 0

            results.append({
                "ml_threshold": ml_t, "diff_threshold": diff_t,
                "ml_games": ml_total, "ml_win_rate": ml_wr,
                "diff_games": diff_total, "diff_win_rate": diff_wr,
                "combined_games": combined_total, "combined_win_rate": combined_wr,
            })
    return results


def run():
    print("Loading backtest data...")
    raw_games = load_games(2025)
    print(f"Loaded {len(raw_games)} games. Pre-computing edges with weights {ZONE_W}/{PITCH_W}/{WALK_W}/{HAND_W}...\n")
    games = precompute_edges(raw_games)

    # --- ML Sweep ---
    ml_results = sweep_ml(games, range(60, 86, 2))
    print("=" * 60)
    print("ML THRESHOLD SWEEP")
    print("=" * 60)
    print(f"  {'Threshold':>10}  {'Games':>6}  {'Wins':>5}  {'Win Rate':>8}")
    print("-" * 40)
    for r in ml_results:
        print(f"  {r['threshold']:>10}  {r['games']:>6}  {r['wins']:>5}  {r['win_rate']:>7.1f}%")

    # --- DIFF Sweep ---
    diff_results = sweep_diff(games, range(6, 26, 2))
    print(f"\n{'=' * 60}")
    print("DIFF THRESHOLD SWEEP")
    print("=" * 60)
    print(f"  {'Threshold':>10}  {'Games':>6}  {'Wins':>5}  {'Win Rate':>8}")
    print("-" * 40)
    for r in diff_results:
        print(f"  {r['threshold']:>10}  {r['games']:>6}  {r['wins']:>5}  {r['win_rate']:>7.1f}%")

    # --- RL Sweep ---
    rl_results = sweep_rl(games, range(68, 90, 2))
    print(f"\n{'=' * 60}")
    print("RL THRESHOLD SWEEP (win by 2+)")
    print("=" * 60)
    print(f"  {'Threshold':>10}  {'Games':>6}  {'W-by-2':>6}  {'Rate':>8}")
    print("-" * 40)
    for r in rl_results:
        print(f"  {r['threshold']:>10}  {r['games']:>6}  {r['win_by_2']:>6}  {r['win_rate']:>7.1f}%")

    # --- Combined ML + DIFF Sweep ---
    combined = sweep_combined(games, range(64, 80, 2), range(8, 20, 2))

    # Sort by combined win rate, then volume
    combined.sort(key=lambda r: (r["combined_win_rate"], r["combined_games"]), reverse=True)

    print(f"\n{'=' * 80}")
    print("COMBINED ML + DIFF SWEEP (DIFF only fires when ML doesn't)")
    print("=" * 80)
    print(f"  {'ML':>4} {'DIFF':>5}  |  {'ML%':>5} {'ML#':>4}  |  {'DIFF%':>6} {'DIFF#':>5}  |  "
          f"{'Comb%':>6} {'Comb#':>5}")
    print("-" * 65)
    for r in combined[:25]:
        print(f"  {r['ml_threshold']:>4} {r['diff_threshold']:>5}  |  "
              f"{r['ml_win_rate']:>5.1f} {r['ml_games']:>4}  |  "
              f"{r['diff_win_rate']:>5.1f} {r['diff_games']:>5}  |  "
              f"{r['combined_win_rate']:>5.1f} {r['combined_games']:>5}")

    # Best balanced: combined WR >= 55%, volume >= 200
    balanced = [r for r in combined if r["combined_win_rate"] >= 55 and r["combined_games"] >= 200]
    balanced.sort(key=lambda r: (r["combined_win_rate"], r["combined_games"]), reverse=True)

    if balanced:
        print(f"\nBEST BALANCED (combined WR >= 55%, games >= 200):")
        print(f"  {'ML':>4} {'DIFF':>5}  |  {'ML%':>5} {'ML#':>4}  |  {'DIFF%':>6} {'DIFF#':>5}  |  "
              f"{'Comb%':>6} {'Comb#':>5}")
        print("-" * 65)
        for r in balanced[:10]:
            print(f"  {r['ml_threshold']:>4} {r['diff_threshold']:>5}  |  "
                  f"{r['ml_win_rate']:>5.1f} {r['ml_games']:>4}  |  "
                  f"{r['diff_win_rate']:>5.1f} {r['diff_games']:>5}  |  "
                  f"{r['combined_win_rate']:>5.1f} {r['combined_games']:>5}")

    # Save to CSV
    out_path = os.path.join(BACKTEST_DIR, "threshold_sweep_2025.csv")
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "ml_threshold", "diff_threshold",
            "ml_games", "ml_win_rate", "diff_games", "diff_win_rate",
            "combined_games", "combined_win_rate",
        ])
        writer.writeheader()
        writer.writerows(combined)
    print(f"\nFull combined results saved to {out_path}")


if __name__ == "__main__":
    run()
