"""Detailed ROI analysis for backtest with real odds."""
import csv
import os
from collections import defaultdict


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
    return max(0.10, min(0.90, round(0.45 + (e / 100) * 0.25, 4)))


def diff_to_win_prob(d):
    return max(0.50, min(0.70, round(0.50 + (d / 80) * 0.20, 4)))


HOME_FIELD_ADJ = 3
ZONE_W, PITCH_W, WALK_W, HAND_W = 49, 22, 19, 10
ORIG_ZONE, ORIG_PITCH, ORIG_WALK, ORIG_HAND = 40, 30, 15, 15
VALUE_EDGE_MIN = 0.04


def apply_park_factor(raw, pf):
    adj = raw * (1 + (1.0 - pf) * 0.5)
    adjustment = max(-10, min(10, adj - raw))
    return round(raw + adjustment, 2)


def reweight(row):
    zm = ZONE_W / ORIG_ZONE
    pm = PITCH_W / ORIG_PITCH
    wm = WALK_W / ORIG_WALK
    hm = HAND_W / ORIG_HAND
    hr = max(0, min(100,
        row["home_zone"] * zm + row["home_pitch"] * pm +
        row["home_walk"] * wm + row["home_hand"] * hm))
    ar = max(0, min(100,
        row["away_zone"] * zm + row["away_pitch"] * pm +
        row["away_walk"] * wm + row["away_hand"] * hm))
    hp = apply_park_factor(hr, row["park_factor"])
    ap = apply_park_factor(ar, row["park_factor"])
    return (
        round(hp + row["park_weather_adj"] + row["home_bp_mod"] + HOME_FIELD_ADJ, 2),
        round(ap + row["park_weather_adj"] + row["away_bp_mod"], 2),
    )


def run():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "backtest", "backtest_2025_with_odds.csv")
    rows = []
    with open(data_path, newline="") as f:
        for r in csv.DictReader(f):
            for k in ("home_zone", "home_pitch", "home_walk", "home_hand",
                       "away_zone", "away_pitch", "away_walk", "away_hand",
                       "park_factor", "park_weather_adj", "home_bp_mod", "away_bp_mod",
                       "home_score", "away_score"):
                r[k] = float(r.get(k) or 0)
            r["home_ml"] = float(r["home_ml"]) if r.get("home_ml") and r["home_ml"] != "None" else None
            r["away_ml"] = float(r["away_ml"]) if r.get("away_ml") and r["away_ml"] != "None" else None
            r["home_won"] = r["home_score"] > r["away_score"]
            he, ae = reweight(r)
            r["he"], r["ae"] = he, ae
            rows.append(r)

    # Build bet list
    bets = []
    for r in rows:
        he, ae = r["he"], r["ae"]
        diff = abs(he - ae)
        mx = max(he, ae)
        fh = he > ae
        hml, aml = r["home_ml"], r["away_ml"]
        hw = r["home_won"]
        if hml is None or aml is None:
            continue

        bml, oml = (hml, aml) if fh else (aml, hml)
        won = hw if fh else not hw
        signal = None
        mp = lp = ve = None

        if mx >= 70:
            mp = edge_to_win_prob(mx)
            lp = no_vig_prob(bml, oml)
            ve = (mp - lp) if lp else None
            if ve is not None and ve >= VALUE_EDGE_MIN:
                signal = "ML"
        elif diff >= 12:
            mp = diff_to_win_prob(diff)
            lp = no_vig_prob(bml, oml)
            ve = (mp - lp) if lp else None
            if ve is not None and ve >= VALUE_EDGE_MIN:
                signal = "DIFF"

        if signal:
            bets.append({
                "date": r["date"],
                "month": r["date"][:7],
                "signal": signal,
                "home": r["home_team"],
                "away": r["away_team"],
                "edge": mx,
                "diff": diff,
                "ml": bml,
                "opp_ml": oml,
                "won": won,
                "profit": ml_profit(bml, won),
                "is_fav": bml < 0,
                "is_dog": bml > 0,
                "is_home": fh,
                "value_edge": ve,
            })

    div = "=" * 70
    print(div)
    print(f"DETAILED ANALYSIS — ML 70 / DIFF 12 + VALUE >= 4%")
    print(f"Total bets: {len(bets)}")
    print(div)

    # 1. Monthly breakdown
    print("\n--- MONTHLY BREAKDOWN ---")
    print(f"  {'Month':>7} | {'ML#':>3} {'ML W':>5} {'ML$':>8} | {'D#':>3} {'D W':>5} {'D$':>8} | {'Tot#':>4} {'TotW':>5} {'Tot$':>8}")
    print("  " + "-" * 75)
    months = sorted(set(b["month"] for b in bets))
    for m in months:
        mb = [b for b in bets if b["month"] == m]
        ml_b = [b for b in mb if b["signal"] == "ML"]
        d_b = [b for b in mb if b["signal"] == "DIFF"]
        ml_w = sum(1 for b in ml_b if b["won"])
        ml_p = sum(b["profit"] for b in ml_b)
        d_w = sum(1 for b in d_b if b["won"])
        d_p = sum(b["profit"] for b in d_b)
        t_w = ml_w + d_w
        t_p = ml_p + d_p
        ml_wr = f"{ml_w}/{len(ml_b)}" if ml_b else "  -"
        d_wr = f"{d_w}/{len(d_b)}" if d_b else "  -"
        t_wr = f"{t_w}/{len(mb)}"
        print(f"  {m:>7} | {len(ml_b):>3} {ml_wr:>5} {ml_p:>+8.0f} | {len(d_b):>3} {d_wr:>5} {d_p:>+8.0f} | {len(mb):>4} {t_wr:>5} {t_p:>+8.0f}")

    # 2. Favorite vs Underdog
    print("\n--- FAVORITE vs UNDERDOG ---")
    for label, filt in [("Favorite (ML < 0)", lambda b: b["is_fav"]),
                         ("Underdog (ML > 0)", lambda b: b["is_dog"])]:
        subset = [b for b in bets if filt(b)]
        if not subset:
            continue
        w = sum(1 for b in subset if b["won"])
        p = sum(b["profit"] for b in subset)
        roi = p / (len(subset) * 100) * 100
        avg_ml = sum(b["ml"] for b in subset) / len(subset)
        print(f"  {label}:")
        print(f"    Bets: {len(subset)}, Win: {w}/{len(subset)} = {w/len(subset)*100:.1f}%, "
              f"Profit: ${p:+.0f}, ROI: {roi:+.1f}%, Avg ML: {avg_ml:+.0f}")
        for sig in ["ML", "DIFF"]:
            ss = [b for b in subset if b["signal"] == sig]
            if not ss:
                continue
            sw = sum(1 for b in ss if b["won"])
            sp = sum(b["profit"] for b in ss)
            sr = sp / (len(ss) * 100) * 100
            print(f"      {sig}: {len(ss)} bets, {sw}/{len(ss)} won, ${sp:+.0f}, ROI {sr:+.1f}%")

    # 3. ML by edge tier
    print("\n--- ML SIGNAL BY EDGE TIER ---")
    ml_bets = [b for b in bets if b["signal"] == "ML"]
    for lo, hi in [(70, 74), (74, 78), (78, 82), (82, 100)]:
        tier = [b for b in ml_bets if lo <= b["edge"] < hi]
        if not tier:
            continue
        w = sum(1 for b in tier if b["won"])
        p = sum(b["profit"] for b in tier)
        roi = p / (len(tier) * 100) * 100
        avg_v = sum(b["value_edge"] for b in tier) / len(tier) * 100
        print(f"  Edge {lo}-{hi}: {len(tier)} bets, {w}/{len(tier)} = {w/len(tier)*100:.1f}% WR, "
              f"${p:+.0f}, ROI {roi:+.1f}%, Avg Value +{avg_v:.1f}%")

    # 4. DIFF by gap tier
    print("\n--- DIFF SIGNAL BY GAP TIER ---")
    d_bets = [b for b in bets if b["signal"] == "DIFF"]
    for lo, hi in [(12, 16), (16, 20), (20, 25), (25, 40)]:
        tier = [b for b in d_bets if lo <= b["diff"] < hi]
        if not tier:
            continue
        w = sum(1 for b in tier if b["won"])
        p = sum(b["profit"] for b in tier)
        roi = p / (len(tier) * 100) * 100
        print(f"  Gap {lo}-{hi}: {len(tier)} bets, {w}/{len(tier)} = {w/len(tier)*100:.1f}% WR, "
              f"${p:+.0f}, ROI {roi:+.1f}%")

    # 5. Home vs Away
    print("\n--- HOME vs AWAY ---")
    for label, filt in [("Bet HOME", lambda b: b["is_home"]),
                         ("Bet AWAY", lambda b: not b["is_home"])]:
        subset = [b for b in bets if filt(b)]
        w = sum(1 for b in subset if b["won"])
        p = sum(b["profit"] for b in subset)
        roi = p / (len(subset) * 100) * 100
        print(f"  {label}: {len(subset)} bets, {w}/{len(subset)} = {w/len(subset)*100:.1f}% WR, "
              f"${p:+.0f}, ROI {roi:+.1f}%")
        for sig in ["ML", "DIFF"]:
            ss = [b for b in subset if b["signal"] == sig]
            if not ss:
                continue
            sw = sum(1 for b in ss if b["won"])
            sp = sum(b["profit"] for b in ss)
            sr = sp / (len(ss) * 100) * 100
            print(f"      {sig}: {len(ss)} bets, {sw}/{len(ss)} won, ${sp:+.0f}, ROI {sr:+.1f}%")

    # 6. Value edge tiers
    print("\n--- BY VALUE EDGE SIZE ---")
    for lo, hi, label in [(0.04, 0.08, "4-8%"), (0.08, 0.12, "8-12%"),
                           (0.12, 0.20, "12-20%"), (0.20, 1.0, "20%+")]:
        tier = [b for b in bets if lo <= b["value_edge"] < hi]
        if not tier:
            continue
        w = sum(1 for b in tier if b["won"])
        p = sum(b["profit"] for b in tier)
        roi = p / (len(tier) * 100) * 100
        print(f"  Value {label}: {len(tier)} bets, {w}/{len(tier)} = {w/len(tier)*100:.1f}% WR, "
              f"${p:+.0f}, ROI {roi:+.1f}%")

    # 7. By quarter
    print("\n--- BY SEASON PHASE ---")
    for label, lo_m, hi_m in [("Mar-Apr (early)", 3, 4), ("May-Jun", 5, 6),
                                ("Jul-Aug", 7, 8), ("Sep (late)", 9, 9)]:
        tier = [b for b in bets if lo_m <= int(b["date"][5:7]) <= hi_m]
        if not tier:
            continue
        w = sum(1 for b in tier if b["won"])
        p = sum(b["profit"] for b in tier)
        roi = p / (len(tier) * 100) * 100
        print(f"  {label}: {len(tier)} bets, {w}/{len(tier)} = {w/len(tier)*100:.1f}% WR, "
              f"${p:+.0f}, ROI {roi:+.1f}%")

    # 8. Top winners
    print("\n--- TOP 10 WINS ---")
    winners = sorted(bets, key=lambda b: b["profit"], reverse=True)[:10]
    for b in winners:
        print(f"  {b['date']}  {b['away']:25s} @ {b['home']:25s}  {b['signal']:4s}  "
              f"ML {b['ml']:+.0f}  Edge {b['edge']:.0f}  ${b['profit']:+.0f}")

    # 9. Worst losses
    print("\n--- TOP 10 LOSSES ---")
    losers = sorted(bets, key=lambda b: b["profit"])[:10]
    for b in losers:
        print(f"  {b['date']}  {b['away']:25s} @ {b['home']:25s}  {b['signal']:4s}  "
              f"ML {b['ml']:+.0f}  Edge {b['edge']:.0f}  ${b['profit']:+.0f}")

    # 10. Cumulative P/L curve data points
    print("\n--- CUMULATIVE P/L (every 25 bets) ---")
    sorted_bets = sorted(bets, key=lambda b: b["date"])
    running = 0
    for i, b in enumerate(sorted_bets):
        running += b["profit"]
        if (i + 1) % 25 == 0 or i == len(sorted_bets) - 1:
            print(f"  Bet {i+1:>4}: ${running:>+8.0f}  ({b['date']})")

    # 11. Max drawdown
    peak = 0
    running = 0
    max_dd = 0
    dd_start = dd_end = ""
    peak_date = sorted_bets[0]["date"]
    for b in sorted_bets:
        running += b["profit"]
        if running > peak:
            peak = running
            peak_date = b["date"]
        dd = peak - running
        if dd > max_dd:
            max_dd = dd
            dd_start = peak_date
            dd_end = b["date"]

    print(f"\n--- MAX DRAWDOWN ---")
    print(f"  ${max_dd:.0f} from {dd_start} to {dd_end}")
    print(f"  Final P/L: ${running:+.0f}")


if __name__ == "__main__":
    run()
