"""Export: recompute edge scores with new weights, merge historical odds, write CSV."""
import csv
import os
import sys

import pandas as pd

BACKTEST_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "backtest")
ODDS_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "odds")
HOME_FIELD_ADJ = 3
ZONE_W, PITCH_W, WALK_W, HAND_W = 49, 22, 19, 10
ORIG_ZONE, ORIG_PITCH, ORIG_WALK, ORIG_HAND = 40, 30, 15, 15

ML_EDGE_THRESHOLD = 70
DIFF_EDGE_THRESHOLD = 12
VALUE_EDGE_MIN = 0.04


def apply_park_factor(raw, pf):
    adj = raw * (1 + (1.0 - pf) * 0.5)
    adjustment = max(-10, min(10, adj - raw))
    return round(raw + adjustment, 2)


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
        return None
    t = r + ro
    return round(r / t, 4) if t else None


def edge_to_win_prob(e):
    return max(0.10, min(0.90, round(0.45 + (e / 100) * 0.25, 4)))


def diff_to_win_prob(d):
    return max(0.50, min(0.70, round(0.50 + (d / 80) * 0.20, 4)))


def ml_profit(ml, won):
    if ml is None:
        return None
    if won:
        return round((100 / abs(ml) * 100) if ml < 0 else ml, 2)
    return -100


def main():
    in_path = os.path.join(BACKTEST_DIR, "backtest_2025.csv")
    odds_path = os.path.join(ODDS_DIR, "oddsportal_2025.csv")
    out_path = os.path.join(BACKTEST_DIR, "backtest_2025_reweighted.csv")

    with open(in_path, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if "home_zone" not in rows[0]:
        print("ERROR: CSV missing component scores.")
        sys.exit(1)

    # Load odds
    odds_lookup = {}
    if os.path.exists(odds_path):
        odds_df = pd.read_csv(odds_path)
        for _, o in odds_df.iterrows():
            key = (o["game_date"], o["home_team_abbr"], o["away_team_abbr"])
            odds_lookup[key] = (o["home_odds"], o["away_odds"])
        print(f"Loaded {len(odds_lookup)} odds records")
    else:
        print("WARNING: No odds file found — profit/loss columns will be empty")

    zm = ZONE_W / ORIG_ZONE
    pm = PITCH_W / ORIG_PITCH
    wm = WALK_W / ORIG_WALK
    hm = HAND_W / ORIG_HAND

    matched = 0
    for row in rows:
        for k in ("home_zone", "home_pitch", "home_walk", "home_hand",
                   "away_zone", "away_pitch", "away_walk", "away_hand",
                   "park_factor", "park_weather_adj", "home_bp_mod", "away_bp_mod"):
            row[k] = float(row.get(k) or 0)

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

        row["home_edge_score"] = home_final
        row["away_edge_score"] = away_final
        row["edge_diff"] = round(abs(home_final - away_final), 1)

        home_won = float(row["home_score"]) > float(row["away_score"])
        max_edge = max(home_final, away_final)
        favored_home = home_final > away_final
        diff = abs(home_final - away_final)

        # Match odds
        key = (row["date"], row["home_team"], row["away_team"])
        home_ml, away_ml = odds_lookup.get(key, (None, None))
        if home_ml is not None and away_ml is not None:
            # Convert numpy floats
            home_ml = float(home_ml)
            away_ml = float(away_ml)
            matched += 1

        row["home_moneyline"] = home_ml if home_ml is not None else ""
        row["away_moneyline"] = away_ml if away_ml is not None else ""

        # Determine bet side
        if favored_home:
            bet_ml = home_ml
            opp_ml = away_ml
            bet_side = "HOME"
            won = home_won
        else:
            bet_ml = away_ml
            opp_ml = home_ml
            bet_side = "AWAY"
            won = not home_won

        # Value edge calc
        line_prob = no_vig_prob(bet_ml, opp_ml) if bet_ml is not None else None

        # ML signal
        if max_edge >= ML_EDGE_THRESHOLD:
            model_prob = edge_to_win_prob(max_edge)
            value_edge = round(model_prob - line_prob, 4) if line_prob else None

            row["ml_signal"] = bet_side
            row["ml_model_prob"] = round(model_prob * 100, 1)
            row["ml_line_prob"] = round(line_prob * 100, 1) if line_prob else ""
            row["ml_value_edge"] = round(value_edge * 100, 1) if value_edge is not None else ""

            if value_edge is not None and value_edge >= VALUE_EDGE_MIN:
                row["ml_result"] = "WIN" if won else "LOSS"
                row["ml_bet_ml"] = bet_ml if bet_ml is not None else ""
                row["ml_profit"] = ml_profit(bet_ml, won) if bet_ml is not None else ""
            else:
                row["ml_result"] = "NO VALUE"
                row["ml_bet_ml"] = ""
                row["ml_profit"] = ""
        else:
            row["ml_signal"] = "NO BET"
            row["ml_model_prob"] = ""
            row["ml_line_prob"] = ""
            row["ml_value_edge"] = ""
            row["ml_result"] = "NO BET"
            row["ml_bet_ml"] = ""
            row["ml_profit"] = ""

        # DIFF signal (only when ML doesn't fire)
        if max_edge < ML_EDGE_THRESHOLD and diff >= DIFF_EDGE_THRESHOLD:
            model_prob = diff_to_win_prob(diff)
            value_edge = round(model_prob - line_prob, 4) if line_prob else None

            row["diff_signal"] = bet_side
            row["diff_gap"] = round(diff, 1)
            row["diff_model_prob"] = round(model_prob * 100, 1)
            row["diff_line_prob"] = round(line_prob * 100, 1) if line_prob else ""
            row["diff_value_edge"] = round(value_edge * 100, 1) if value_edge is not None else ""

            if value_edge is not None and value_edge >= VALUE_EDGE_MIN:
                row["diff_result"] = "WIN" if won else "LOSS"
                row["diff_bet_ml"] = bet_ml if bet_ml is not None else ""
                row["diff_profit"] = ml_profit(bet_ml, won) if bet_ml is not None else ""
            else:
                row["diff_result"] = "NO VALUE"
                row["diff_bet_ml"] = ""
                row["diff_profit"] = ""
        else:
            row["diff_signal"] = "NO BET"
            row["diff_gap"] = round(diff, 1)
            row["diff_model_prob"] = ""
            row["diff_line_prob"] = ""
            row["diff_value_edge"] = ""
            row["diff_result"] = "NO BET"
            row["diff_bet_ml"] = ""
            row["diff_profit"] = ""

    fieldnames = list(rows[0].keys())
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} games to {out_path}")
    print(f"Odds matched: {matched}/{len(rows)} ({matched/len(rows)*100:.1f}%)")

    # Quick summary
    ml_bets = [r for r in rows if r["ml_result"] in ("WIN", "LOSS")]
    diff_bets = [r for r in rows if r["diff_result"] in ("WIN", "LOSS")]

    if ml_bets:
        ml_w = sum(1 for r in ml_bets if r["ml_result"] == "WIN")
        ml_p = sum(float(r["ml_profit"]) for r in ml_bets if r["ml_profit"])
        print(f"\nML: {len(ml_bets)} bets, {ml_w}/{len(ml_bets)} won ({ml_w/len(ml_bets)*100:.1f}%), "
              f"${ml_p:+.0f} profit, {ml_p/(len(ml_bets)*100)*100:+.1f}% ROI")

    if diff_bets:
        d_w = sum(1 for r in diff_bets if r["diff_result"] == "WIN")
        d_p = sum(float(r["diff_profit"]) for r in diff_bets if r["diff_profit"])
        print(f"DIFF: {len(diff_bets)} bets, {d_w}/{len(diff_bets)} won ({d_w/len(diff_bets)*100:.1f}%), "
              f"${d_p:+.0f} profit, {d_p/(len(diff_bets)*100)*100:+.1f}% ROI")

    if ml_bets or diff_bets:
        tot = len(ml_bets) + len(diff_bets)
        tot_w = sum(1 for r in ml_bets if r["ml_result"] == "WIN") + sum(1 for r in diff_bets if r["diff_result"] == "WIN")
        tot_p = sum(float(r["ml_profit"]) for r in ml_bets if r["ml_profit"]) + \
                sum(float(r["diff_profit"]) for r in diff_bets if r["diff_profit"])
        print(f"COMBINED: {tot} bets, {tot_w}/{tot} won ({tot_w/tot*100:.1f}%), "
              f"${tot_p:+.0f} profit, {tot_p/(tot*100)*100:+.1f}% ROI")


if __name__ == "__main__":
    main()
