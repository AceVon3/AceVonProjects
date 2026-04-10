"""
weight_sweep.py — Sweep edge score component weights using pre-computed data.

Reads backtest_2025.csv (with raw component scores), re-weights the components,
reconstructs final edge scores + signals, and evaluates calibration for each
weight combination. Runs in seconds instead of hours.

Usage:
    py -3 -m src.weight_sweep [--step 5] [--ml-threshold 70]
"""

import csv
import os
import sys
import itertools
from collections import defaultdict

BACKTEST_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "backtest")

# Default thresholds (match signal.py)
ML_EDGE_THRESHOLD = 70
DIFF_EDGE_THRESHOLD = 12
HOME_FIELD_ADJ = 3

# Original component max ranges
ORIG_ZONE = 40
ORIG_PITCH = 30
ORIG_WALK = 15
ORIG_HAND = 15


def load_games(season: int) -> list:
    """Load backtest results with component scores."""
    path = os.path.join(BACKTEST_DIR, f"backtest_{season}.csv")
    games = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Verify component scores exist
            if "home_zone" not in row:
                print("ERROR: backtest CSV missing component scores. Re-run backtest first.")
                sys.exit(1)
            # Convert numeric fields
            for key in ("home_zone", "home_pitch", "home_walk", "home_hand",
                        "away_zone", "away_pitch", "away_walk", "away_hand",
                        "park_factor", "park_weather_adj",
                        "home_bp_mod", "away_bp_mod",
                        "home_bullpen_score", "away_bullpen_score",
                        "home_score", "away_score", "actual_total",
                        "home_edge_score", "away_edge_score",
                        "ou_score", "model_total"):
                if row.get(key):
                    row[key] = float(row[key])
                else:
                    row[key] = 0.0
            row["home_won"] = row["home_score"] > row["away_score"]
            row["total_runs"] = row["home_score"] + row["away_score"]
            games.append(row)
    return games


def apply_park_factor(raw_score: float, park_factor: float) -> float:
    """Replicate score.py apply_park_factor."""
    adj = raw_score * (1 + (1.0 - park_factor) * 0.5)
    adjustment = adj - raw_score
    adjustment = max(-10, min(10, adjustment))
    return round(raw_score + adjustment, 2)


def reweight_game(game: dict, zone_w: float, pitch_w: float,
                  walk_w: float, hand_w: float) -> dict:
    """Re-compute edge scores for a game with new weights.

    Weights are target percentages (e.g. 35 for 35%).
    Multipliers scale original component ranges to new targets.
    """
    zone_mult = zone_w / ORIG_ZONE
    pitch_mult = pitch_w / ORIG_PITCH
    walk_mult = walk_w / ORIG_WALK
    hand_mult = hand_w / ORIG_HAND

    # Raw edge scores with new weights
    home_raw = (game["home_zone"] * zone_mult +
                game["home_pitch"] * pitch_mult +
                game["home_walk"] * walk_mult +
                game["home_hand"] * hand_mult)
    home_raw = max(0, min(100, home_raw))

    away_raw = (game["away_zone"] * zone_mult +
                game["away_pitch"] * pitch_mult +
                game["away_walk"] * walk_mult +
                game["away_hand"] * hand_mult)
    away_raw = max(0, min(100, away_raw))

    # Apply park factor
    home_park = apply_park_factor(home_raw, game["park_factor"])
    away_park = apply_park_factor(away_raw, game["park_factor"])

    # Apply weather (use stored adjustment)
    home_weather = round(home_park + game["park_weather_adj"], 2)
    away_weather = round(away_park + game["park_weather_adj"], 2)

    # Apply bullpen + home field
    home_final = round(home_weather + game["home_bp_mod"] + HOME_FIELD_ADJ, 2)
    away_final = round(away_weather + game["away_bp_mod"], 2)

    return {"home_edge": home_final, "away_edge": away_final}


def evaluate_combo(games: list, zone_w: float, pitch_w: float,
                   walk_w: float, hand_w: float,
                   ml_threshold: int = ML_EDGE_THRESHOLD) -> dict:
    """Evaluate a single weight combination across all games."""
    ml_buckets = defaultdict(lambda: {"total": 0, "wins": 0})
    diff_buckets = defaultdict(lambda: {"total": 0, "wins": 0})
    rl_data = {"total": 0, "win_by_2": 0}
    total_games = 0

    for game in games:
        total_games += 1
        edges = reweight_game(game, zone_w, pitch_w, walk_w, hand_w)
        home_edge = edges["home_edge"]
        away_edge = edges["away_edge"]
        home_won = game["home_won"]
        margin = abs(game["home_score"] - game["away_score"])

        # ML signal
        max_edge = max(home_edge, away_edge)
        if max_edge >= ml_threshold:
            bucket = int(max_edge // 5) * 5
            ml_buckets[bucket]["total"] += 1
            # Did the higher-edge side win?
            if home_edge > away_edge and home_won:
                ml_buckets[bucket]["wins"] += 1
            elif away_edge > home_edge and not home_won:
                ml_buckets[bucket]["wins"] += 1

        # RL (edge >= 75)
        if max_edge >= 75:
            rl_data["total"] += 1
            if home_edge > away_edge and home_won and margin >= 2:
                rl_data["win_by_2"] += 1
            elif away_edge > home_edge and not home_won and margin >= 2:
                rl_data["win_by_2"] += 1

        # DIFF signal
        diff = abs(home_edge - away_edge)
        if diff >= DIFF_EDGE_THRESHOLD:
            bucket = int(diff // 4) * 4
            diff_buckets[bucket]["total"] += 1
            if home_edge > away_edge and home_won:
                diff_buckets[bucket]["wins"] += 1
            elif away_edge > home_edge and not home_won:
                diff_buckets[bucket]["wins"] += 1

    # Aggregate stats
    ml_total = sum(d["total"] for d in ml_buckets.values())
    ml_wins = sum(d["wins"] for d in ml_buckets.values())
    diff_total = sum(d["total"] for d in diff_buckets.values())
    diff_wins = sum(d["wins"] for d in diff_buckets.values())

    return {
        "zone": zone_w, "pitch": pitch_w, "walk": walk_w, "hand": hand_w,
        "ml_games": ml_total,
        "ml_win_rate": round(ml_wins / ml_total * 100, 1) if ml_total else 0,
        "diff_games": diff_total,
        "diff_win_rate": round(diff_wins / diff_total * 100, 1) if diff_total else 0,
        "rl_games": rl_data["total"],
        "rl_win_by_2": round(rl_data["win_by_2"] / rl_data["total"] * 100, 1) if rl_data["total"] else 0,
        "ml_buckets": dict(ml_buckets),
        "diff_buckets": dict(diff_buckets),
    }


def generate_combos(step: int = 5,
                    zone_range=(25, 50), pitch_range=(20, 45),
                    walk_range=(5, 25), hand_range=(0, 20)) -> list:
    """Generate all weight combos that sum to 100 within given ranges."""
    combos = []
    for z in range(zone_range[0], zone_range[1] + 1, step):
        for p in range(pitch_range[0], pitch_range[1] + 1, step):
            for w in range(walk_range[0], walk_range[1] + 1, step):
                h = 100 - z - p - w
                if hand_range[0] <= h <= hand_range[1]:
                    combos.append((z, p, w, h))
    return combos


def run_sweep(season: int = 2025, step: int = 5, ml_threshold: int = ML_EDGE_THRESHOLD):
    """Run the full weight sweep and print results."""
    print(f"Loading backtest data for {season}...")
    games = load_games(season)
    print(f"Loaded {len(games)} games with component scores.\n")

    combos = generate_combos(step=step)
    print(f"Testing {len(combos)} weight combinations (step={step}%)...\n")

    results = []
    for z, p, w, h in combos:
        result = evaluate_combo(games, z, p, w, h, ml_threshold)
        results.append(result)

    # Sort by ML win rate (primary), then DIFF win rate
    results.sort(key=lambda r: (r["ml_win_rate"], r["diff_win_rate"]), reverse=True)

    # Print current baseline first
    baseline = evaluate_combo(games, 40, 30, 15, 15, ml_threshold)
    print("=" * 90)
    print(f"CURRENT WEIGHTS (baseline):  Zone=40  Pitch=30  Walk=15  Hand=15")
    print(f"  ML: {baseline['ml_win_rate']:.1f}% ({baseline['ml_games']}g)  |  "
          f"DIFF: {baseline['diff_win_rate']:.1f}% ({baseline['diff_games']}g)  |  "
          f"RL win-by-2: {baseline['rl_win_by_2']:.1f}% ({baseline['rl_games']}g)")
    print("=" * 90)

    # Top 20 by ML win rate
    print(f"\nTOP 20 BY ML WIN RATE (threshold={ml_threshold}):")
    print(f"{'Zone':>5} {'Pitch':>6} {'Walk':>5} {'Hand':>5}  |  "
          f"{'ML%':>5} {'ML#':>4}  |  {'DIFF%':>6} {'DIFF#':>5}  |  "
          f"{'RL%':>5} {'RL#':>4}")
    print("-" * 75)
    for r in results[:20]:
        print(f"{r['zone']:>5} {r['pitch']:>6} {r['walk']:>5} {r['hand']:>5}  |  "
              f"{r['ml_win_rate']:>5.1f} {r['ml_games']:>4}  |  "
              f"{r['diff_win_rate']:>5.1f} {r['diff_games']:>5}  |  "
              f"{r['rl_win_by_2']:>5.1f} {r['rl_games']:>4}")

    # Top 20 by DIFF win rate
    results_diff = sorted(results, key=lambda r: (r["diff_win_rate"], r["ml_win_rate"]), reverse=True)
    print(f"\nTOP 20 BY DIFF WIN RATE:")
    print(f"{'Zone':>5} {'Pitch':>6} {'Walk':>5} {'Hand':>5}  |  "
          f"{'ML%':>5} {'ML#':>4}  |  {'DIFF%':>6} {'DIFF#':>5}  |  "
          f"{'RL%':>5} {'RL#':>4}")
    print("-" * 75)
    for r in results_diff[:20]:
        print(f"{r['zone']:>5} {r['pitch']:>6} {r['walk']:>5} {r['hand']:>5}  |  "
              f"{r['ml_win_rate']:>5.1f} {r['ml_games']:>4}  |  "
              f"{r['diff_win_rate']:>5.1f} {r['diff_games']:>5}  |  "
              f"{r['rl_win_by_2']:>5.1f} {r['rl_games']:>4}")

    # Best balanced (ML >= 55% AND DIFF >= 52% AND ML games >= 50)
    balanced = [r for r in results
                if r["ml_win_rate"] >= 55 and r["diff_win_rate"] >= 52 and r["ml_games"] >= 50]
    balanced.sort(key=lambda r: r["ml_win_rate"] + r["diff_win_rate"], reverse=True)

    if balanced:
        print(f"\nBEST BALANCED (ML >= 55% AND DIFF >= 52% AND ML games >= 50):")
        print(f"{'Zone':>5} {'Pitch':>6} {'Walk':>5} {'Hand':>5}  |  "
              f"{'ML%':>5} {'ML#':>4}  |  {'DIFF%':>6} {'DIFF#':>5}  |  "
              f"{'RL%':>5} {'RL#':>4}")
        print("-" * 75)
        for r in balanced[:15]:
            print(f"{r['zone']:>5} {r['pitch']:>6} {r['walk']:>5} {r['hand']:>5}  |  "
                  f"{r['ml_win_rate']:>5.1f} {r['ml_games']:>4}  |  "
                  f"{r['diff_win_rate']:>5.1f} {r['diff_games']:>5}  |  "
                  f"{r['rl_win_by_2']:>5.1f} {r['rl_games']:>4}")
    else:
        print("\nNo combos met the balanced criteria.")

    # Save all results to CSV
    out_path = os.path.join(BACKTEST_DIR, f"weight_sweep_{season}.csv")
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "zone", "pitch", "walk", "hand",
            "ml_games", "ml_win_rate", "diff_games", "diff_win_rate",
            "rl_games", "rl_win_by_2",
        ])
        writer.writeheader()
        for r in results:
            writer.writerow({k: v for k, v in r.items()
                            if k not in ("ml_buckets", "diff_buckets")})
    print(f"\nFull results saved to {out_path}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sweep edge score component weights")
    parser.add_argument("--season", type=int, default=2025)
    parser.add_argument("--step", type=int, default=5, help="Weight step size in %%")
    parser.add_argument("--ml-threshold", type=int, default=ML_EDGE_THRESHOLD)
    args = parser.parse_args()
    run_sweep(args.season, args.step, args.ml_threshold)
