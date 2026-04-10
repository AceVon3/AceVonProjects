"""
weight_sweep_roi.py — Sweep all weight combinations using real historical odds.

For each weight combo (zone/pitch/walk/hand summing to 100), recomputes edge
scores from cached components, applies ML + DIFF thresholds with value check,
and calculates actual profit/loss using OddsPortal closing lines.

Usage:
    py -3 -m src.weight_sweep_roi [--step 5] [--ml 70] [--diff 12] [--value 0.04]
"""

import csv
import os
import sys
import time
from itertools import product

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
BACKTEST_CSV = os.path.join(DATA_DIR, "backtest", "backtest_2025_with_odds.csv")
OUTPUT_CSV = os.path.join(DATA_DIR, "backtest", "weight_sweep_roi_results.csv")

HOME_FIELD_ADJ = 3
ORIG_ZONE, ORIG_PITCH, ORIG_WALK, ORIG_HAND = 40, 30, 15, 15


def ml_profit(ml, won):
    if ml is None:
        return 0
    if won:
        return (100 / abs(ml) * 100) if ml < 0 else ml
    return -100


def moneyline_to_implied_prob(line):
    if line is None or line == 0:
        return None
    if line < 0:
        return abs(line) / (abs(line) + 100)
    return 100 / (line + 100)


def no_vig_prob(line, opp):
    r = moneyline_to_implied_prob(line)
    ro = moneyline_to_implied_prob(opp)
    if r is None or ro is None:
        return r
    t = r + ro
    return round(r / t, 4) if t else r


def edge_to_win_prob(e):
    return max(0.10, min(0.90, 0.45 + (e / 100) * 0.25))


def diff_to_win_prob(d):
    return max(0.50, min(0.70, 0.50 + (d / 80) * 0.20))


def apply_park_factor(raw, pf):
    adj = raw * (1 + (1.0 - pf) * 0.5)
    adjustment = max(-10, min(10, adj - raw))
    return raw + adjustment


def load_games():
    """Load backtest games with pre-computed components and matched odds."""
    games = []
    with open(BACKTEST_CSV, newline="") as f:
        for r in csv.DictReader(f):
            g = {}
            for k in ("home_zone", "home_pitch", "home_walk", "home_hand",
                       "away_zone", "away_pitch", "away_walk", "away_hand",
                       "park_factor", "park_weather_adj", "home_bp_mod", "away_bp_mod",
                       "home_score", "away_score"):
                g[k] = float(r.get(k) or 0)

            g["home_ml"] = float(r["home_ml"]) if r.get("home_ml") and r["home_ml"] != "None" else None
            g["away_ml"] = float(r["away_ml"]) if r.get("away_ml") and r["away_ml"] != "None" else None
            g["home_won"] = g["home_score"] > g["away_score"]
            g["date"] = r["date"]
            g["home_team"] = r["home_team"]
            g["away_team"] = r["away_team"]

            # Skip games without odds
            if g["home_ml"] is not None and g["away_ml"] is not None:
                games.append(g)
    return games


def evaluate_weights(games, zone_w, pitch_w, walk_w, hand_w,
                     ml_threshold, diff_threshold, value_min):
    """Evaluate a single weight combination across all games.

    Returns dict with stats for ML, DIFF, and combined signals.
    """
    zm = zone_w / ORIG_ZONE
    pm = pitch_w / ORIG_PITCH
    wm = walk_w / ORIG_WALK
    hm = hand_w / ORIG_HAND

    ml_wins = ml_total = 0
    ml_profit_sum = 0.0
    diff_wins = diff_total = 0
    diff_profit_sum = 0.0

    # Also track win rate without value check for reference
    ml_edge_wins = ml_edge_total = 0
    diff_edge_wins = diff_edge_total = 0

    for g in games:
        # Reweight
        home_raw = max(0, min(100,
            g["home_zone"] * zm + g["home_pitch"] * pm +
            g["home_walk"] * wm + g["home_hand"] * hm))
        away_raw = max(0, min(100,
            g["away_zone"] * zm + g["away_pitch"] * pm +
            g["away_walk"] * wm + g["away_hand"] * hm))

        home_park = apply_park_factor(home_raw, g["park_factor"])
        away_park = apply_park_factor(away_raw, g["park_factor"])

        home_edge = home_park + g["park_weather_adj"] + g["home_bp_mod"] + HOME_FIELD_ADJ
        away_edge = away_park + g["park_weather_adj"] + g["away_bp_mod"]

        max_edge = max(home_edge, away_edge)
        diff = abs(home_edge - away_edge)
        favored_home = home_edge > away_edge

        if favored_home:
            bet_ml, opp_ml = g["home_ml"], g["away_ml"]
            won = g["home_won"]
        else:
            bet_ml, opp_ml = g["away_ml"], g["home_ml"]
            won = not g["home_won"]

        # ML signal
        if max_edge >= ml_threshold:
            ml_edge_total += 1
            if won:
                ml_edge_wins += 1

            # Value check
            model_prob = edge_to_win_prob(max_edge)
            line_prob = no_vig_prob(bet_ml, opp_ml)
            if line_prob is not None:
                value_edge = model_prob - line_prob
                if value_edge >= value_min:
                    ml_total += 1
                    profit = ml_profit(bet_ml, won)
                    ml_profit_sum += profit
                    if won:
                        ml_wins += 1

        # DIFF signal (only when ML doesn't fire)
        elif diff >= diff_threshold:
            diff_edge_total += 1
            if won:
                diff_edge_wins += 1

            model_prob = diff_to_win_prob(diff)
            line_prob = no_vig_prob(bet_ml, opp_ml)
            if line_prob is not None:
                value_edge = model_prob - line_prob
                if value_edge >= value_min:
                    diff_total += 1
                    profit = ml_profit(bet_ml, won)
                    diff_profit_sum += profit
                    if won:
                        diff_wins += 1

    combined_total = ml_total + diff_total
    combined_wins = ml_wins + diff_wins
    combined_profit = ml_profit_sum + diff_profit_sum

    return {
        "zone_w": zone_w, "pitch_w": pitch_w,
        "walk_w": walk_w, "hand_w": hand_w,
        "ml_bets": ml_total,
        "ml_wins": ml_wins,
        "ml_wr": round(ml_wins / ml_total * 100, 1) if ml_total else 0,
        "ml_profit": round(ml_profit_sum, 2),
        "ml_roi": round(ml_profit_sum / (ml_total * 100) * 100, 1) if ml_total else 0,
        "ml_edge_bets": ml_edge_total,
        "ml_edge_wr": round(ml_edge_wins / ml_edge_total * 100, 1) if ml_edge_total else 0,
        "diff_bets": diff_total,
        "diff_wins": diff_wins,
        "diff_wr": round(diff_wins / diff_total * 100, 1) if diff_total else 0,
        "diff_profit": round(diff_profit_sum, 2),
        "diff_roi": round(diff_profit_sum / (diff_total * 100) * 100, 1) if diff_total else 0,
        "diff_edge_bets": diff_edge_total,
        "diff_edge_wr": round(diff_edge_wins / diff_edge_total * 100, 1) if diff_edge_total else 0,
        "combined_bets": combined_total,
        "combined_wins": combined_wins,
        "combined_wr": round(combined_wins / combined_total * 100, 1) if combined_total else 0,
        "combined_profit": round(combined_profit, 2),
        "combined_roi": round(combined_profit / (combined_total * 100) * 100, 1) if combined_total else 0,
    }


def generate_weight_combos(step=5, full_range=False):
    """Generate all (zone, pitch, walk, hand) combos that sum to 100."""
    combos = []
    if full_range:
        for z in range(0, 101, step):
            for p in range(0, 101 - z, step):
                for w in range(0, 101 - z - p, step):
                    h = 100 - z - p - w
                    combos.append((z, p, w, h))
    else:
        for z in range(25, 51, step):
            for p in range(20, 46, step):
                for w in range(5, 26, step):
                    h = 100 - z - p - w
                    if 0 <= h <= 20:
                        combos.append((z, p, w, h))
    return combos


def run():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--step", type=int, default=5)
    parser.add_argument("--ml", type=int, default=70)
    parser.add_argument("--diff", type=int, default=12)
    parser.add_argument("--value", type=float, default=0.04)
    parser.add_argument("--full", action="store_true", help="Use full 0-100 range for all weights")
    args = parser.parse_args()

    print("Loading backtest data with odds...")
    games = load_games()
    print(f"  {len(games)} games with odds")

    combos = generate_weight_combos(args.step, full_range=args.full)
    print(f"  {len(combos)} weight combinations (step {args.step})")
    print(f"  Thresholds: ML >= {args.ml}, DIFF >= {args.diff}, Value >= {args.value*100:.0f}%")
    print()

    results = []
    start = time.time()
    for i, (z, p, w, h) in enumerate(combos):
        r = evaluate_weights(games, z, p, w, h, args.ml, args.diff, args.value)
        results.append(r)
        if (i + 1) % 50 == 0:
            elapsed = time.time() - start
            rate = (i + 1) / elapsed
            remaining = (len(combos) - i - 1) / rate
            print(f"  {i+1}/{len(combos)} done ({rate:.0f}/sec, ~{remaining:.0f}s remaining)")

    elapsed = time.time() - start
    print(f"\nCompleted {len(combos)} combos in {elapsed:.1f}s")

    # Sort by combined ROI (min 50 bets)
    viable = [r for r in results if r["combined_bets"] >= 50]
    viable.sort(key=lambda r: r["combined_roi"], reverse=True)

    div = "=" * 90

    # Top 20 by combined ROI
    print(f"\n{div}")
    print("TOP 20 BY COMBINED ROI (>= 50 bets)")
    print(div)
    print(f"  {'Z':>3} {'P':>3} {'W':>3} {'H':>3} | "
          f"{'ML#':>4} {'ML%':>5} {'ML_ROI':>7} | "
          f"{'D#':>4} {'D%':>5} {'D_ROI':>7} | "
          f"{'Tot#':>5} {'Tot%':>5} {'ROI':>7} {'Profit':>8}")
    print("  " + "-" * 82)
    for r in viable[:20]:
        print(f"  {r['zone_w']:>3} {r['pitch_w']:>3} {r['walk_w']:>3} {r['hand_w']:>3} | "
              f"{r['ml_bets']:>4} {r['ml_wr']:>4.1f}% {r['ml_roi']:>+6.1f}% | "
              f"{r['diff_bets']:>4} {r['diff_wr']:>4.1f}% {r['diff_roi']:>+6.1f}% | "
              f"{r['combined_bets']:>5} {r['combined_wr']:>4.1f}% {r['combined_roi']:>+6.1f}% "
              f"${r['combined_profit']:>+7.0f}")

    # Top 20 by ML ROI (min 30 ML bets)
    ml_viable = [r for r in results if r["ml_bets"] >= 30]
    ml_viable.sort(key=lambda r: r["ml_roi"], reverse=True)

    print(f"\n{div}")
    print("TOP 20 BY ML ROI (>= 30 ML bets)")
    print(div)
    print(f"  {'Z':>3} {'P':>3} {'W':>3} {'H':>3} | "
          f"{'ML#':>4} {'ML%':>5} {'ML_ROI':>7} {'ML$':>8} | "
          f"{'EdgeOnly#':>9} {'EdgeWR':>6}")
    print("  " + "-" * 65)
    for r in ml_viable[:20]:
        print(f"  {r['zone_w']:>3} {r['pitch_w']:>3} {r['walk_w']:>3} {r['hand_w']:>3} | "
              f"{r['ml_bets']:>4} {r['ml_wr']:>4.1f}% {r['ml_roi']:>+6.1f}% "
              f"${r['ml_profit']:>+7.0f} | "
              f"{r['ml_edge_bets']:>9} {r['ml_edge_wr']:>5.1f}%")

    # Top 20 by total profit (min 50 bets)
    profit_viable = [r for r in results if r["combined_bets"] >= 50]
    profit_viable.sort(key=lambda r: r["combined_profit"], reverse=True)

    print(f"\n{div}")
    print("TOP 20 BY TOTAL PROFIT (>= 50 bets)")
    print(div)
    print(f"  {'Z':>3} {'P':>3} {'W':>3} {'H':>3} | "
          f"{'ML#':>4} {'ML$':>8} | "
          f"{'D#':>4} {'D$':>8} | "
          f"{'Tot#':>5} {'Tot$':>8} {'ROI':>7}")
    print("  " + "-" * 70)
    for r in profit_viable[:20]:
        print(f"  {r['zone_w']:>3} {r['pitch_w']:>3} {r['walk_w']:>3} {r['hand_w']:>3} | "
              f"{r['ml_bets']:>4} ${r['ml_profit']:>+7.0f} | "
              f"{r['diff_bets']:>4} ${r['diff_profit']:>+7.0f} | "
              f"{r['combined_bets']:>5} ${r['combined_profit']:>+7.0f} {r['combined_roi']:>+6.1f}%")

    # Best balanced: ROI >= 5%, bets >= 100
    balanced = [r for r in results if r["combined_roi"] >= 5 and r["combined_bets"] >= 100]
    balanced.sort(key=lambda r: (r["combined_roi"], r["combined_profit"]), reverse=True)

    if balanced:
        print(f"\n{div}")
        print("BEST BALANCED (ROI >= 5%, bets >= 100)")
        print(div)
        print(f"  {'Z':>3} {'P':>3} {'W':>3} {'H':>3} | "
              f"{'ML#':>4} {'ML%':>5} {'ML_ROI':>7} | "
              f"{'D#':>4} {'D%':>5} {'D_ROI':>7} | "
              f"{'Tot#':>5} {'Tot%':>5} {'ROI':>7} {'Profit':>8}")
        print("  " + "-" * 82)
        for r in balanced[:15]:
            print(f"  {r['zone_w']:>3} {r['pitch_w']:>3} {r['walk_w']:>3} {r['hand_w']:>3} | "
                  f"{r['ml_bets']:>4} {r['ml_wr']:>4.1f}% {r['ml_roi']:>+6.1f}% | "
                  f"{r['diff_bets']:>4} {r['diff_wr']:>4.1f}% {r['diff_roi']:>+6.1f}% | "
                  f"{r['combined_bets']:>5} {r['combined_wr']:>4.1f}% {r['combined_roi']:>+6.1f}% "
                  f"${r['combined_profit']:>+7.0f}")

    # Compare current weights
    current = next((r for r in results
                     if r["zone_w"] == 30 and r["pitch_w"] == 35
                     and r["walk_w"] == 15 and r["hand_w"] == 20), None)
    if current:
        print(f"\n{div}")
        print("CURRENT WEIGHTS (30/35/15/20) FOR REFERENCE")
        print(div)
        print(f"  ML:   {current['ml_bets']} bets, {current['ml_wr']:.1f}% WR, "
              f"{current['ml_roi']:+.1f}% ROI, ${current['ml_profit']:+.0f}")
        print(f"  DIFF: {current['diff_bets']} bets, {current['diff_wr']:.1f}% WR, "
              f"{current['diff_roi']:+.1f}% ROI, ${current['diff_profit']:+.0f}")
        print(f"  Combined: {current['combined_bets']} bets, {current['combined_wr']:.1f}% WR, "
              f"{current['combined_roi']:+.1f}% ROI, ${current['combined_profit']:+.0f}")

    # Save all results
    print(f"\nSaving all {len(results)} results to {OUTPUT_CSV}...")
    fieldnames = list(results[0].keys())
    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    print("Done.")


if __name__ == "__main__":
    run()
