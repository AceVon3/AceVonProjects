"""
backtest_roi.py — Merge historical odds into backtest data and compute ROI.

Matches OddsPortal closing lines to backtest_2025.csv games by date + teams,
then evaluates ML, DIFF, and combined signals with real moneylines to get
actual profit/loss and ROI.

Usage:
    py -3 -m src.backtest_roi
"""

import csv
import os
import sys
from collections import defaultdict

import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
BACKTEST_CSV = os.path.join(DATA_DIR, "backtest", "backtest_2025.csv")
ODDS_CSV = os.path.join(DATA_DIR, "odds", "oddsportal_2025.csv")
OUTPUT_CSV = os.path.join(DATA_DIR, "backtest", "backtest_2025_with_odds.csv")

# Current model thresholds
ML_EDGE_THRESHOLD = 70
DIFF_EDGE_THRESHOLD = 12
VALUE_EDGE_MIN = 0.04

# Reweight constants (same as score.py / threshold_sweep.py)
HOME_FIELD_ADJ = 3
ZONE_W, PITCH_W, WALK_W, HAND_W = 49, 22, 19, 10
ORIG_ZONE, ORIG_PITCH, ORIG_WALK, ORIG_HAND = 40, 30, 15, 15


def moneyline_to_implied_prob(line):
    if line is None or line == 0:
        return None
    if line < 0:
        return abs(line) / (abs(line) + 100)
    else:
        return 100 / (line + 100)


def no_vig_prob(line, opp_line):
    raw = moneyline_to_implied_prob(line)
    raw_opp = moneyline_to_implied_prob(opp_line)
    if raw is None or raw_opp is None:
        return raw
    total = raw + raw_opp
    if total == 0:
        return raw
    return round(raw / total, 4)


def edge_to_win_prob(edge_score):
    prob = 0.45 + (edge_score / 100) * 0.25
    return max(0.10, min(0.90, round(prob, 4)))


def diff_to_win_prob(diff):
    prob = 0.50 + (diff / 80) * 0.20
    return max(0.50, min(0.70, round(prob, 4)))


def ml_profit(ml, won):
    """Calculate profit on a $100 flat bet."""
    if ml is None:
        return 0
    if won:
        if ml < 0:
            return 100 / abs(ml) * 100
        else:
            return ml
    else:
        return -100


def apply_park_factor(raw, pf):
    adj = raw * (1 + (1.0 - pf) * 0.5)
    adjustment = max(-10, min(10, adj - raw))
    return round(raw + adjustment, 2)


def reweight_edges(row):
    """Recompute edge scores with current weights."""
    zm = ZONE_W / ORIG_ZONE
    pm = PITCH_W / ORIG_PITCH
    wm = WALK_W / ORIG_WALK
    hm = HAND_W / ORIG_HAND

    home_raw = max(0, min(100,
        row["home_zone"] * zm + row["home_pitch"] * pm +
        row["home_walk"] * wm + row["home_hand"] * hm))
    away_raw = max(0, min(100,
        row["away_zone"] * zm + row["away_pitch"] * pm +
        row["away_walk"] * wm + row["away_hand"] * hm))

    home_park = apply_park_factor(home_raw, row["park_factor"])
    away_park = apply_park_factor(away_raw, row["park_factor"])

    home_final = round(home_park + row["park_weather_adj"] + row["home_bp_mod"] + HOME_FIELD_ADJ, 2)
    away_final = round(away_park + row["park_weather_adj"] + row["away_bp_mod"], 2)

    return home_final, away_final


def run():
    # Load backtest
    print("Loading backtest data...")
    bt_rows = []
    with open(BACKTEST_CSV, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            for k in ("home_zone", "home_pitch", "home_walk", "home_hand",
                       "away_zone", "away_pitch", "away_walk", "away_hand",
                       "park_factor", "park_weather_adj", "home_bp_mod", "away_bp_mod",
                       "home_score", "away_score"):
                row[k] = float(row.get(k) or 0)
            row["home_won"] = row["home_score"] > row["away_score"]
            bt_rows.append(row)
    print(f"  {len(bt_rows)} backtest games")

    # Load odds
    print("Loading scraped odds...")
    odds_df = pd.read_csv(ODDS_CSV)
    print(f"  {len(odds_df)} odds records")

    # Build odds lookup: (date, home_team, away_team) -> (home_odds, away_odds)
    odds_lookup = {}
    for _, row in odds_df.iterrows():
        key = (row["game_date"], row["home_team_abbr"], row["away_team_abbr"])
        odds_lookup[key] = (row["home_odds"], row["away_odds"])

    # Match odds to backtest games
    matched = 0
    unmatched = 0
    for row in bt_rows:
        key = (row["date"], row["home_team"], row["away_team"])
        if key in odds_lookup:
            row["home_ml"], row["away_ml"] = odds_lookup[key]
            matched += 1
        else:
            row["home_ml"] = None
            row["away_ml"] = None
            unmatched += 1

    print(f"\n  Matched: {matched} / {len(bt_rows)} ({matched/len(bt_rows)*100:.1f}%)")
    print(f"  Unmatched: {unmatched}")

    # Recompute edges and evaluate signals with real odds
    ml_bets = []
    diff_bets = []
    ml_value_bets = []
    diff_value_bets = []

    for row in bt_rows:
        home_edge, away_edge = reweight_edges(row)
        row["home_edge_rw"] = home_edge
        row["away_edge_rw"] = away_edge
        diff = abs(home_edge - away_edge)
        max_edge = max(home_edge, away_edge)
        favored_home = home_edge > away_edge

        home_ml = row["home_ml"]
        away_ml = row["away_ml"]
        home_won = row["home_won"]

        # --- ML signal (edge only) ---
        if max_edge >= ML_EDGE_THRESHOLD:
            if favored_home:
                bet_ml = home_ml
                won = home_won
            else:
                bet_ml = away_ml
                won = not home_won

            ml_bets.append({
                "date": row["date"],
                "home": row["home_team"],
                "away": row["away_team"],
                "edge": max_edge,
                "ml": bet_ml,
                "won": won,
                "profit": ml_profit(bet_ml, won) if bet_ml else None,
                "has_odds": bet_ml is not None,
            })

            # ML + value check
            if bet_ml is not None:
                opp_ml = away_ml if favored_home else home_ml
                model_prob = edge_to_win_prob(max_edge)
                line_prob = no_vig_prob(bet_ml, opp_ml)
                value_edge = (model_prob - line_prob) if line_prob else None

                if value_edge is not None and value_edge >= VALUE_EDGE_MIN:
                    ml_value_bets.append({
                        "date": row["date"],
                        "home": row["home_team"],
                        "away": row["away_team"],
                        "edge": max_edge,
                        "ml": bet_ml,
                        "model_prob": model_prob,
                        "line_prob": line_prob,
                        "value_edge": value_edge,
                        "won": won,
                        "profit": ml_profit(bet_ml, won),
                    })

        # --- DIFF signal (gap only, when ML doesn't fire) ---
        if max_edge < ML_EDGE_THRESHOLD and diff >= DIFF_EDGE_THRESHOLD:
            if favored_home:
                bet_ml = home_ml
                won = home_won
            else:
                bet_ml = away_ml
                won = not home_won

            diff_bets.append({
                "date": row["date"],
                "home": row["home_team"],
                "away": row["away_team"],
                "diff": diff,
                "ml": bet_ml,
                "won": won,
                "profit": ml_profit(bet_ml, won) if bet_ml else None,
                "has_odds": bet_ml is not None,
            })

            # DIFF + value check
            if bet_ml is not None:
                opp_ml = away_ml if favored_home else home_ml
                model_prob = diff_to_win_prob(diff)
                line_prob = no_vig_prob(bet_ml, opp_ml)
                value_edge = (model_prob - line_prob) if line_prob else None

                if value_edge is not None and value_edge >= VALUE_EDGE_MIN:
                    diff_value_bets.append({
                        "date": row["date"],
                        "home": row["home_team"],
                        "away": row["away_team"],
                        "diff": diff,
                        "ml": bet_ml,
                        "model_prob": model_prob,
                        "line_prob": line_prob,
                        "value_edge": value_edge,
                        "won": won,
                        "profit": ml_profit(bet_ml, won),
                    })

    # --- Results ---
    divider = "=" * 70

    # ML edge-only
    print(f"\n{divider}")
    print(f"ML SIGNAL (edge >= {ML_EDGE_THRESHOLD}, no value check)")
    print(divider)
    _print_stats(ml_bets, "edge")

    # ML + value
    print(f"\n{divider}")
    print(f"ML SIGNAL + VALUE (edge >= {ML_EDGE_THRESHOLD}, value >= {VALUE_EDGE_MIN*100:.0f}%)")
    print(divider)
    _print_value_stats(ml_value_bets, "edge")

    # DIFF edge-only
    print(f"\n{divider}")
    print(f"DIFF SIGNAL (gap >= {DIFF_EDGE_THRESHOLD}, no value check, only when ML doesn't fire)")
    print(divider)
    _print_stats(diff_bets, "diff")

    # DIFF + value
    print(f"\n{divider}")
    print(f"DIFF SIGNAL + VALUE (gap >= {DIFF_EDGE_THRESHOLD}, value >= {VALUE_EDGE_MIN*100:.0f}%, only when ML doesn't fire)")
    print(divider)
    _print_value_stats(diff_value_bets, "diff")

    # Combined
    print(f"\n{divider}")
    print("COMBINED (ML + DIFF with value checks)")
    print(divider)
    all_value = ml_value_bets + diff_value_bets
    if all_value:
        with_odds = [b for b in all_value if b.get("profit") is not None]
        wins = sum(1 for b in with_odds if b["won"])
        total = len(with_odds)
        total_profit = sum(b["profit"] for b in with_odds)
        wr = wins / total * 100 if total else 0
        roi = total_profit / (total * 100) * 100 if total else 0
        print(f"  Bets:      {total} ({len(ml_value_bets)} ML + {len(diff_value_bets)} DIFF)")
        print(f"  Win rate:  {wins}/{total} = {wr:.1f}%")
        print(f"  Profit:    ${total_profit:+.2f} on ${total * 100} wagered")
        print(f"  ROI:       {roi:+.1f}%")

    # Save enriched CSV
    print(f"\n{divider}")
    print("Saving enriched backtest CSV...")
    fieldnames = list(bt_rows[0].keys())
    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(bt_rows)
    print(f"  Saved to {OUTPUT_CSV}")

    # Also sweep thresholds with real ROI
    print(f"\n{divider}")
    print("THRESHOLD SWEEP WITH REAL ROI")
    print(divider)
    _sweep_with_roi(bt_rows)


def _print_stats(bets, score_key):
    if not bets:
        print("  No bets.")
        return

    with_odds = [b for b in bets if b["has_odds"] and b["profit"] is not None]
    without_odds = [b for b in bets if not b["has_odds"]]

    total = len(bets)
    wins_all = sum(1 for b in bets if b["won"])
    wr_all = wins_all / total * 100

    print(f"  Total games:  {total} (with odds: {len(with_odds)}, no odds: {len(without_odds)})")
    print(f"  Win rate:     {wins_all}/{total} = {wr_all:.1f}% (all games)")

    if with_odds:
        wins = sum(1 for b in with_odds if b["won"])
        wr = wins / len(with_odds) * 100
        total_profit = sum(b["profit"] for b in with_odds)
        wagered = len(with_odds) * 100
        roi = total_profit / wagered * 100

        avg_ml = sum(abs(b["ml"]) for b in with_odds) / len(with_odds)
        fav_bets = [b for b in with_odds if b["ml"] < 0]
        dog_bets = [b for b in with_odds if b["ml"] > 0]

        print(f"  Win rate:     {wins}/{len(with_odds)} = {wr:.1f}% (games with odds)")
        print(f"  Total profit: ${total_profit:+.2f} on ${wagered} wagered ($100 flat)")
        print(f"  ROI:          {roi:+.1f}%")
        print(f"  Avg |ML|:     {avg_ml:.0f}")
        print(f"  Favorites:    {len(fav_bets)} bets, "
              f"{sum(1 for b in fav_bets if b['won'])}/{len(fav_bets)} won" if fav_bets else "")
        print(f"  Underdogs:    {len(dog_bets)} bets, "
              f"{sum(1 for b in dog_bets if b['won'])}/{len(dog_bets)} won" if dog_bets else "")


def _print_value_stats(bets, score_key):
    if not bets:
        print("  No bets.")
        return

    wins = sum(1 for b in bets if b["won"])
    total = len(bets)
    wr = wins / total * 100
    total_profit = sum(b["profit"] for b in bets)
    wagered = total * 100
    roi = total_profit / wagered * 100

    avg_value = sum(b["value_edge"] for b in bets) / total * 100
    fav_bets = [b for b in bets if b["ml"] < 0]
    dog_bets = [b for b in bets if b["ml"] > 0]

    print(f"  Bets:         {total}")
    print(f"  Win rate:     {wins}/{total} = {wr:.1f}%")
    print(f"  Total profit: ${total_profit:+.2f} on ${wagered} wagered ($100 flat)")
    print(f"  ROI:          {roi:+.1f}%")
    print(f"  Avg value:    +{avg_value:.1f}%")
    if fav_bets:
        fav_w = sum(1 for b in fav_bets if b["won"])
        fav_profit = sum(b["profit"] for b in fav_bets)
        print(f"  Favorites:    {len(fav_bets)} bets, {fav_w}/{len(fav_bets)} won, ${fav_profit:+.2f}")
    if dog_bets:
        dog_w = sum(1 for b in dog_bets if b["won"])
        dog_profit = sum(b["profit"] for b in dog_bets)
        print(f"  Underdogs:    {len(dog_bets)} bets, {dog_w}/{len(dog_bets)} won, ${dog_profit:+.2f}")


def _sweep_with_roi(bt_rows):
    """Quick threshold sweep showing ROI with real odds."""
    print(f"\n  {'ML':>4} {'DIFF':>5} | {'ML#':>4} {'ML%':>5} {'ML_ROI':>7} | "
          f"{'D#':>4} {'D%':>5} {'D_ROI':>7} | {'Tot#':>5} {'Tot%':>5} {'ROI':>7}")
    print("  " + "-" * 75)

    best_roi = -999
    best_combo = None

    for ml_t in range(66, 80, 2):
        for diff_t in range(8, 20, 2):
            ml_w = ml_total = ml_profit_sum = 0
            d_w = d_total = d_profit_sum = 0

            for row in bt_rows:
                home_edge, away_edge = row["home_edge_rw"], row["away_edge_rw"]
                diff = abs(home_edge - away_edge)
                max_edge = max(home_edge, away_edge)
                favored_home = home_edge > away_edge
                home_won = row["home_won"]
                home_ml = row["home_ml"]
                away_ml = row["away_ml"]

                if home_ml is None or away_ml is None:
                    continue

                if favored_home:
                    bet_ml, opp_ml = home_ml, away_ml
                    won = home_won
                else:
                    bet_ml, opp_ml = away_ml, home_ml
                    won = not home_won

                # ML signal
                if max_edge >= ml_t:
                    model_prob = edge_to_win_prob(max_edge)
                    line_prob = no_vig_prob(bet_ml, opp_ml)
                    value = (model_prob - line_prob) if line_prob else None

                    if value is not None and value >= VALUE_EDGE_MIN:
                        ml_total += 1
                        if won:
                            ml_w += 1
                        ml_profit_sum += ml_profit(bet_ml, won)

                # DIFF signal (only when ML doesn't fire)
                elif diff >= diff_t:
                    model_prob = diff_to_win_prob(diff)
                    line_prob = no_vig_prob(bet_ml, opp_ml)
                    value = (model_prob - line_prob) if line_prob else None

                    if value is not None and value >= VALUE_EDGE_MIN:
                        d_total += 1
                        if won:
                            d_w += 1
                        d_profit_sum += ml_profit(bet_ml, won)

            tot = ml_total + d_total
            tot_w = ml_w + d_w
            tot_profit = ml_profit_sum + d_profit_sum

            ml_wr = ml_w / ml_total * 100 if ml_total else 0
            d_wr = d_w / d_total * 100 if d_total else 0
            tot_wr = tot_w / tot * 100 if tot else 0
            ml_roi = ml_profit_sum / (ml_total * 100) * 100 if ml_total else 0
            d_roi = d_profit_sum / (d_total * 100) * 100 if d_total else 0
            tot_roi = tot_profit / (tot * 100) * 100 if tot else 0

            if tot >= 50 and tot_roi > best_roi:
                best_roi = tot_roi
                best_combo = (ml_t, diff_t, ml_total, ml_wr, ml_roi,
                              d_total, d_wr, d_roi, tot, tot_wr, tot_roi, tot_profit)

            if tot >= 30:
                print(f"  {ml_t:>4} {diff_t:>5} | {ml_total:>4} {ml_wr:>4.1f}% {ml_roi:>+6.1f}% | "
                      f"{d_total:>4} {d_wr:>4.1f}% {d_roi:>+6.1f}% | {tot:>5} {tot_wr:>4.1f}% {tot_roi:>+6.1f}%")

    if best_combo:
        ml_t, diff_t, ml_n, ml_wr, ml_roi, d_n, d_wr, d_roi, tot, tot_wr, tot_roi, tot_profit = best_combo
        print(f"\n  BEST (>= 50 bets): ML {ml_t} / DIFF {diff_t}")
        print(f"    ML:   {ml_n} bets, {ml_wr:.1f}% WR, {ml_roi:+.1f}% ROI")
        print(f"    DIFF: {d_n} bets, {d_wr:.1f}% WR, {d_roi:+.1f}% ROI")
        print(f"    Total: {tot} bets, {tot_wr:.1f}% WR, {tot_roi:+.1f}% ROI, ${tot_profit:+.2f}")


if __name__ == "__main__":
    run()
