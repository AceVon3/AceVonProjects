# Baseball Betting Model — Project Spec

## Overview

A daily Python pipeline that runs during the MLB season. It pulls starting pitcher and lineup data from Baseball Savant (Statcast), builds pitcher, batter, and team bullpen profiles, scores each matchup using a 4-component model, and emits moneyline, run line, and over/under signals when sufficient edge and value are detected. The output is a daily report covering every game — all signals with full reasoning, and minimal no-bet rows showing how close each game came to firing.

---

## Project Structure

```
baseball-model/
├── data/
│   ├── pitchers/           # Cached pitcher profile JSON (one file per player ID)
│   ├── batters/            # Cached batter profile JSON (one file per player ID)
│   ├── bullpens/           # Cached team bullpen profile JSON (one file per team) — updated daily
│   ├── games/              # Daily game records (one JSON file per date)
│   └── park_factors.json   # Park factor lookup — refreshed once per season
├── logs/
│   └── pipeline.log        # Timestamped record of all alerts and failures
├── src/
│   ├── fetch.py            # Data fetching — Statcast, MLB Stats API, odds, weather, game logs
│   ├── profile.py          # Aggregates raw Statcast pitch data into profile objects
│   ├── bullpen.py          # Builds team bullpen scores from ERA/WHIP + recent workload
│   ├── score.py            # 4-component matchup scoring + bullpen modifier + park/weather + O/U
│   ├── signal.py           # Applies ML/RL/O/U thresholds and value checks, emits all signals
│   ├── notify.py           # Formats and prints the daily output report to terminal
│   ├── weather.py          # Fetches wind/temp for each stadium at game time
│   ├── closing_line.py     # Fetches closing lines ~5 min before first pitch (ML, RL, O/U)
│   └── backtest.py         # Runs model over historical season data
├── run_daily.py            # Entry point — morning pass orchestrator
├── run_pregame.py          # Pregame pass — re-fetches, diffs, re-scores
├── .env                    # API keys and config — never commit to version control
├── .gitignore              # Must include .env and logs/
├── results_log.csv         # Running log of all signals, results, P&L, CLV
└── requirements.txt
```

---

## Dependencies

```
pybaseball       # Statcast pitcher/batter data + FanGraphs park factors
MLB-StatsAPI     # Schedule, probable starters, lineups, boxscores, game logs
requests         # Odds API + weather API calls
pandas           # Aggregating raw Statcast pitch data into profile metrics
numpy            # Zone map normalization, score calculations
schedule         # Cron-style scheduling of morning and pregame passes
python-dotenv    # Loading API keys and config from .env file
```

Install: `pip install pybaseball MLB-StatsAPI requests pandas numpy schedule python-dotenv`

---

## Data Sources

| Data Needed | Source | Implementation |
|---|---|---|
| Pitcher pitch mix + zones | Baseball Savant (Statcast) | `pybaseball.statcast_pitcher(player_id, start_dt, end_dt)` — raw pitch-level rows; profile.py aggregates |
| Batter zone performance | Baseball Savant (Statcast) | `pybaseball.statcast_batter(player_id, start_dt, end_dt)` |
| Today's starting pitchers | MLB Stats API | `statsapi.mlb.com/api/v1/schedule?date=today&hydrate=probablePitcher` |
| Today's lineups | MLB Stats API | `statsapi.mlb.com/api/v1/game/{id}/boxscore` — gamePk from schedule |
| Bullpen workload (last 3 days) | MLB Stats API | Game logs per team — aggregate reliever IP over last 3 days |
| Bullpen ERA + WHIP | FanGraphs / pybaseball | Season pitching leaderboard — filter to IP < 80, cross-ref active roster, aggregate weighted by IP |
| Park factors | FanGraphs | `pybaseball.fg_park(season)` — store in `data/park_factors.json` |
| Moneylines, run lines, O/U | The Odds API | `api.the-odds-api.com/v4/sports/baseball_mlb/odds?markets=h2h,spreads,totals` — free tier ~500 req/month; fetch all markets in one call per game |
| Closing lines (ML, RL, O/U) | The Odds API | Same endpoint — fetch ~5 min before first pitch for all bet games |
| Weather at game time | OpenWeatherMap or WeatherAPI.com | Fetch ~90 min before first pitch. Use Open-Meteo for backtest historical data |

> **Important:** Statcast returns raw pitch-level data — one row per pitch. `profile.py` must derive all metrics (bb_pct, whiff_rate, zone_map, pitch_mix, etc.) from this raw data. This is the most significant implementation task in the pipeline.

---

## Data Schema

### Pitcher Profile
Stored as JSON in `data/pitchers/{pitcher_id}.json`. Updated daily for active starters only.

| Field | Type | Description |
|---|---|---|
| pitcher_id | string | MLB player ID |
| name | string | Full name |
| hand | L / R | Throwing hand |
| pitch_mix | object | % usage per pitch type (FF, SL, CH, CU, SI, etc.) |
| primary_pitch | string | Pitch type with highest usage % |
| zone_map | 9-cell grid | % of pitches thrown to each zone (1–9 + out-of-zone) |
| preferred_zones | array | Top 3 zones by usage |
| bb_pct | float | Walk rate (BB/PA) |
| chase_rate | float | O-Swing% |
| whiff_rate | float | SwStr% |
| k_pct | float | Strikeout rate (K/PA) |
| vs_lhh_splits | object | Pitch mix + zone map vs. left-handed hitters |
| vs_rhh_splits | object | Pitch mix + zone map vs. right-handed hitters |
| sample_size | int | Number of pitches in dataset |
| last_updated | date | Date of last refresh |

### Batter Profile
Stored as JSON in `data/batters/{batter_id}.json`. Updated daily for active lineup players only.

| Field | Type | Description |
|---|---|---|
| batter_id | string | MLB player ID |
| name | string | Full name |
| hand | L / R / S | Batting hand (S = switch) |
| zone_hot_spots | 9-cell grid | wOBA per zone — where hitter thrives |
| zone_cold_spots | 9-cell grid | Zones where hitter struggles |
| preferred_hit_zones | array | Top 3 zones by production |
| vulnerable_zones | array | Bottom 3 zones by production |
| pitch_type_perf | object | wOBA vs. each pitch type |
| best_pitch_type | string | Pitch type with highest wOBA against |
| worst_pitch_type | string | Pitch type with lowest wOBA against |
| bb_pct | float | Walk rate (BB/PA) |
| k_pct | float | Strikeout rate |
| chase_rate | float | O-Swing% |
| contact_rate | float | Contact% on swings |
| sample_size | int | Number of plate appearances |
| last_updated | date | Date of last refresh |

### Bullpen Profile
Stored as JSON in `data/bullpens/{team_id}.json`. Updated daily for all teams playing today.

| Field | Type | Description |
|---|---|---|
| team_id | string | Team abbreviation |
| bullpen_era | float | Season ERA for all relievers on active roster (IP < 80, cross-ref active 26-man) |
| bullpen_whip | float | Season WHIP — weighted by innings pitched across qualifying relievers |
| workload_3day | float | Total reliever innings pitched in last 3 days (from MLB Stats API game logs) |
| high_lev_available | boolean | True if top 2 relievers by usage rate have not appeared in last 2 days |
| bullpen_score | float | Composite 0–100 score — higher = stronger, fresher bullpen |
| last_updated | date | Date of last refresh |

**Bullpen Score Formula:**

| Component | Weight | Direction |
|---|---|---|
| bullpen_era | 35% | Lower ERA = higher score |
| bullpen_whip | 25% | Lower WHIP = higher score |
| workload_3day | 25% | Higher workload = lower score |
| high_lev_available | 15% | Unavailable = sharp score drop |

**Bullpen.py Aggregation Steps:**
1. Pull season pitching leaderboard via pybaseball, filter to `IP < 80` (reliever proxy)
2. Cross-reference against active 26-man roster from MLB Stats API — drop inactive/IL players
3. Aggregate ERA and WHIP weighted by innings pitched across qualifying relievers
4. Pull team game logs from MLB Stats API for last 3 days, sum reliever IP per team
5. Define top 2 relievers by usage rate as "primary" — check game logs for appearances in last 2 days

### Game Record
Stored as JSON in `data/games/{date}.json`.

| Field | Type | Description |
|---|---|---|
| game_id | string | MLB game ID |
| date | date | Game date |
| home_team | string | Home team abbreviation |
| away_team | string | Away team abbreviation |
| home_starter_id | string | Pitcher ID for home starter |
| away_starter_id | string | Pitcher ID for away starter |
| home_lineup | array[9] | Ordered batter IDs for home team |
| away_lineup | array[9] | Ordered batter IDs for away team |
| home_edge_score | float | Raw matchup edge for home team (before bullpen modifier + park/weather) |
| away_edge_score | float | Raw matchup edge for away team |
| home_bullpen_score | float | Composite bullpen score for home team (0–100) |
| away_bullpen_score | float | Composite bullpen score for away team (0–100) |
| park_weather_adjustment | float | Combined park + weather adjustment |
| park_factor | float | Stadium run environment multiplier (1.0 = neutral) |
| weather_wind_mph | int | Wind speed at first pitch |
| weather_wind_dir | string | Wind direction (e.g. 'out to CF', 'in from LF') |
| weather_temp_f | int | Temperature at first pitch in Fahrenheit |
| bet_signal | string | HOME / AWAY / NO BET |
| bet_market | string | ML / RL_ALERT / NO BET — ML fires with value check; RL_ALERT is manual flag until calibrated |
| home_moneyline | int | Opening moneyline for home team |
| away_moneyline | int | Opening moneyline for away team |
| home_run_line | int | Opening run line moneyline for home team (e.g. -1.5 at +140) |
| away_run_line | int | Opening run line moneyline for away team (e.g. +1.5 at -160) |
| ou_line | float | Opening over/under total (e.g. 8.5) |
| ou_over_odds | int | Opening over moneyline |
| ou_under_odds | int | Opening under moneyline |
| ou_signal | string | OVER / UNDER / NO BET |
| ou_model_total | float | Model's estimated total runs scored (see formula below) |
| ou_score | float | Directional O/U score (0–100, baseline 50) |
| ou_value_edge | float | Implied prob from model total discrepancy vs. book implied prob |
| model_win_prob | float | Model's estimated win probability for bet-side team |
| line_win_prob | float | Book's implied win probability from moneyline |
| value_edge | float | model_win_prob minus line_win_prob |
| home_closing_line | int | Closing moneyline for home team |
| away_closing_line | int | Closing moneyline for away team |
| home_closing_run_line | int | Closing run line moneyline for home team |
| away_closing_run_line | int | Closing run line moneyline for away team |
| ou_closing_line | float | Closing over/under total |
| closing_line_value | float | value_edge recalculated using closing line |
| line_move_home | int | Opening to closing moneyline movement for home team |
| starter_confirmed | boolean | Starting pitcher officially confirmed |
| lineup_confirmed | boolean | Lineup officially posted |
| signal_version | string | 'morning' or 'final' |
| starter_changed | boolean | True if starter changed between passes |
| result | string | WIN / LOSS / PUSH — filled in after game |

---

## Matchup Scoring Logic

### Components 1–4 (Edge Score: -40 to 100)

**Component 1 — Zone Alignment Score (0 to 40 pts)**
- Pitcher's top attack zones overlap with batter's cold zones → positive for pitcher
- Pitcher's zones overlap with batter's hot zones → negative (batter has edge)
- Score per batter = `(# overlapping cold zones × 3) - (# overlapping hot zones × 3)`
- Aggregate across all 9 starters with position weighting, normalize to 0–40

**Component 2 — Pitch Type Mismatch Score (0 to 30 pts)**
- Pitcher's primary pitch = batter's worst pitch type → +4 pts
- Pitcher's primary pitch = batter's best pitch type → -3 pts
- Pitcher throws 60%+ of a pitch batter struggles with → +2 pts bonus
- Aggregate across lineup, normalize to 0–30

**Component 3 — Walk Rate Interaction Score (0 to 15 pts)**
- `Walk_Score = (lineup_avg_bb_pct - pitcher_bb_pct) × 50`, capped ±15
- Positive = batting team benefits; negative = pitching team benefits

**Component 4 — Handedness Adjustment (0 to 15 pts)**
- 6+ batters facing pitcher from his dominant split side → +5 pts for pitcher
- Normalize to 0–15; use vs_lhh_splits or vs_rhh_splits when lineup skews heavily

```
Raw Edge Score = Zone Alignment + Pitch Mismatch + Walk Rate + Handedness
Max = 100 | Min = -40
Positive = pitching team advantage | Negative = batting team advantage
```

### Lineup Position Weighting

| Lineup Spots | Multiplier |
|---|---|
| 1, 2, 3, 4 | 1.25× |
| 5, 6 | 1.0× |
| 7, 8, 9 | 0.75× |

### Bullpen Modifier (Net Differential — Applied After Park/Weather)

The bullpen modifier uses the net differential between both teams' bullpen scores. This means a strong pitching team bullpen vs. a weak batting team bullpen amplifies the edge — and the reverse reduces it.

```python
net_bullpen_modifier = (pitching_team_bullpen_score - batting_team_bullpen_score) / 10
net_bullpen_modifier = max(-10, min(10, net_bullpen_modifier))  # cap at ±10 pts
final_edge_score = park_weather_adjusted_score + net_bullpen_modifier
```

Examples:
- Pitching bullpen 80, batting bullpen 45 → modifier = +3.5 pts (edge amplified)
- Pitching bullpen 40, batting bullpen 75 → modifier = -3.5 pts (edge reduced)
- Both teams at 60 → modifier = 0 (no change)

---

## Park & Weather Adjustment

Applied sequentially to raw edge score before bullpen modifier.

### Park Factor
Source: `pybaseball.fg_park(season)`. FanGraphs scale: 100 = neutral. Convert to decimal (e.g. 105 → 1.05).

```
park_adjusted_score = raw_score × (1 + (1.0 - park_factor) × 0.5)
Cap at ±10 pts
```

### Weather Adjustment (additive, after park factor)

| Condition | Adjustment |
|---|---|
| Wind 15+ mph blowing OUT to CF | -5 pts to pitching edge |
| Wind 15+ mph blowing IN from CF | +5 pts to pitching edge |
| Cross wind 15+ mph | ±2 pts directional |
| Wind < 15 mph | No adjustment |
| Temperature < 45°F | +3 pts to pitching edge |
| Temperature > 90°F | -2 pts to pitching edge |

---

## Bet Signal Thresholds

Side signals (ML/RL) and O/U signal are evaluated separately. A game can fire both simultaneously.

| Condition | Signal |
|---|---|
| Final edge score 65–74 (pitching team) | BET ML — pitching team |
| Final edge score >= 75 (pitching team) | BET ML + RL_ALERT — ML fires with value check; RL is manual flag only |
| Final edge score <= 25 | BET ML — batting team |
| Edge score 26–64 | NO BET (side) |
| Both teams edge score >= 60 | NO BET conflicted — side only; O/U can still fire |
| O/U score >= 65 AND ou_value_edge >= +4% | BET OVER or UNDER |

**Run Line Note:** RL_ALERT means the output shows the run line odds for your review but no automated bet is placed. Once 100+ games at edge score 75+ are tracked and a win-by-2+ calibration curve is built, RL_ALERT converts to a full RL signal with value edge check.

---

## Over/Under Scoring

The O/U score starts at baseline 50 (neutral) and every factor always contributes — there are no conditional bonuses. This ensures the score is well-defined even on calm, neutral-park days.

### O/U Model Total Formula

```python
model_total = 9.0                                    # MLB average baseline (both teams)
model_total -= (edge_score / 100) * 2.5             # pitcher dominance reduces runs
model_total += (park_factor - 1.0) * 3.0            # park factor shifts total
model_total += weather_run_adj                       # wind out +0.5; wind in -0.5; cold -0.3; hot +0.2
avg_bullpen = (home_bullpen_score + away_bullpen_score) / 2
model_total -= 0.5 if avg_bullpen >= 70 else 0      # both bullpens strong = fewer runs
model_total += 0.5 if avg_bullpen < 50 else 0       # both bullpens weak = more runs
```

Compare `model_total` to the book's line to determine OVER/UNDER direction and value edge.

### O/U Score (Baseline 50, Always Applied)

| Factor | Adjustment Range | Notes |
|---|---|---|
| Edge score (scaled) | -20 to +20 | Edge 100 = -20 (strong UNDER); Edge 0 = 0; Edge -40 = +16 (OVER lean) |
| Park factor | -10 to +10 | Neutral park = 0; hitter park pushes up; pitcher park pushes down |
| Wind direction + speed | -8 to +8 | Out to CF 15+ mph = +8; in from CF = -8; cross wind = ±4; calm = 0 |
| Avg bullpen score | -10 to +10 | Avg >= 70 = -10 (UNDER); avg < 50 = +10 (OVER); scales linearly between |
| Temperature | -5 to +3 | < 45°F = -5; > 90°F = +3; neutral = 0 |

```
Final O/U score = 50 + sum of all adjustments, capped 0–100
Score <= 35 = BET UNDER (baseline 50 pushed down by 15+ pts)
Score >= 65 = BET OVER  (baseline 50 pushed up by 15+ pts)
35 < score < 65 = NO BET on O/U
Apply ou_value_edge check before confirming either signal
```

---

## Odds & Value Check

### Moneyline → Implied Probability

```python
# Favorite (negative line)
implied_prob = abs(line) / (abs(line) + 100)

# Underdog (positive line)
implied_prob = 100 / (line + 100)
```

### Value Edge Rules

```python
# Moneyline — fires with value check
value_edge = model_win_prob - ml_implied_prob
# Signal if: final_edge_score >= 65 AND value_edge >= 0.04

# Run line — manual alert only until calibrated
# No value edge check. RL_ALERT fires when final_edge_score >= 75.
# Future: rl_value_edge = rl_model_prob - rl_implied_prob (requires win-by-2+ calibration)

# Over/Under — fires with value check
ou_value_edge = ou_model_prob - ou_implied_prob  # derived from model_total vs. book line
# Signal if: ou_score >= 65 AND ou_value_edge >= 0.04
# Fetch over and under prices separately — they may differ (e.g. Over -115, Under -105)
```

All model probabilities need calibration curves from backtesting. Until 100+ real games are tracked, treat them as relative signals.

---

## Two-Pass Execution System

| Pass | Timing | What Happens |
|---|---|---|
| Morning Run | ~10am ET | Fetch probable starters, pull targeted pitcher/batter/bullpen profiles, score matchups (edge + O/U), write morning signals |
| Pregame Run | ~75–90 min before first pitch | Re-fetch confirmed starters + lineups, update bullpen workload, pull profiles only for newly added batters, re-score changed games, re-check all lines (ML/RL/O/U), emit final signals |

**Proxy lineup:** If lineups not posted at morning time, use top 9 batters by recent PA per team. Pregame pass corrects mismatches.

### Re-Score Triggers

| Trigger | Action |
|---|---|
| Starter swap detected | Force full re-score + alert |
| Key batter scratched | Re-score lineup matchup |
| Line moves > 10 pts (ML, RL, or O/U) | Re-run value check |
| Lineup not yet confirmed | Hold final signal |

### run_daily.py Functions

| Function | Responsibility |
|---|---|
| `morning_pass()` | Fetch starters, pull targeted profiles + bullpen scores, score all matchups (edge + O/U), write morning signals |
| `fetch_confirmed()` | Re-fetch starters + lineups + updated bullpen workload; pull new batter profiles only |
| `diff_check()` | Flag starter changes, lineup changes, significant line moves |
| `pregame_pass()` | Re-score changed games, re-run all value checks (ML/O/U), flag RL_ALERTs, override morning signals |
| `notify()` | Send final signals only |

---

## Closing Line Value (CLV) Tracking

Track CLV for ML and O/U. RL CLV tracked for informational purposes but not used in automated decisions until calibrated.

```python
closing_line_value = closing_implied_prob - opening_implied_prob
# Positive = market moved in your direction (good)
```

| CLV Pattern | Meaning |
|---|---|
| Consistently positive CLV + positive ROI | Real edge — sustainable |
| Consistently positive CLV + negative ROI | Unlucky variance — will correct |
| Negative CLV + positive ROI | Not sustainable — will revert |
| Consistently negative CLV + negative ROI | Wrong side — revisit logic |

---

## Daily Output Format

### Report Header
- Date + total game count
- Active thresholds: `ML >= 65 · RL alert >= 75 · O/U >= 65 · Value edge >= +4% (ML and O/U)`
- Summary: total games / ML signals / RL alerts / O/U signals / no-bet games
- Pass version: morning or final

### Bet Signal Rows (expanded)
- Matchup, game time, starters, stadium
- Signal badge(s): BET ML / RL_ALERT / BET OVER / BET UNDER — multiple can fire on one game
- Edge score (final, after all adjustments) + both bullpen scores
- Moneyline + run line odds displayed for edge score >= 75 games
- O/U line + over/under odds for O/U signals
- Model total, line implied probability, model probability, value edge

### No-Bet Rows (minimal)
- Matchup, game time, starters
- Edge score pill + O/U score pill + value edge pill
- Games with edge score < 30 and O/U score between 40–60 collapsed to summary line

**Delivery:** Both morning and final passes print to terminal only. You copy and send the output.

---

## Backtest Plan

1. Download full Statcast season data via pybaseball (use the most recent completed season)
2. Reconstruct daily lineups, starters, and bullpen workloads from MLB Stats API
3. Fetch historical weather via Open-Meteo (free, no API key)
4. Run scoring day-by-day — log edge score, O/U score, model total, all signals, actual results
5. Build ML calibration curve: edge score bucket → observed win rate
6. Build O/U calibration: model total discrepancy → observed over/under rate
7. Build RL calibration (after sufficient 75+ edge score games): win-by-2+ rate by edge bucket
8. Tune all three thresholds independently — 65/75/65 are starting points only
9. Analyze bullpen modifier contribution: does it improve win rate when applied?

**Do not bet real money until 200+ backtested signals per market with positive ROI.**

---

## Cold Start Strategy (Opening Day & Early Season)

At the start of the season there is zero current-season Statcast data. The model needs a cold start strategy to function from day one.

### Opening Day Bootstrap

Run `src/bootstrap.py` once before the first game of the season. It pulls the full prior season (`current_year - 1`) of Statcast data for all pitchers and batters on opening day rosters and stores them as normal profile JSON with `data_source = 'prior_season'`.

- Spring training data exists but is unreliable — ignore it entirely
- Bullpen profiles: bootstrap from prior season ERA/WHIP for all relievers on opening day rosters
- Rookies and players with no prior MLB data: use league average profiles, flag as `data_source = 'league_avg'`

### Seasonal Blend Curve

As the season accumulates data, profiles transition from prior-season to blended to fully current. Blend is controlled by pitch count (pitchers) or plate appearances (batters).

| Sample Size | Prior Season Weight | Current Season Weight | data_source |
|---|---|---|---|
| 0–199 pitches / PA | 100% | 0% | prior_season |
| 200–499 pitches / PA | 70% | 30% | blended_early |
| 500–999 pitches / PA | 40% | 60% | blended_late |
| 1000+ pitches / PA | 0% | 100% | current_season |

Each metric is blended independently: `blended_metric = (prior × prior_weight) + (current × current_weight)`

### Handling Missing Players

Players without prior season data still follow the blend curve — league average acts as the prior season baseline instead of a real player profile. They are never stuck permanently on league average.

| Player Type | Handling |
|---|---|
| Has prior season MLB data | Use prior season (`current_year - 1`) profile as bootstrap — normal cold start path |
| Rookie / no prior MLB data | Start on league average (`data_source = 'league_avg'`). Blend curve still applies — as current season data accumulates, transition from league average toward `current_season` using the same thresholds. At 1000+ pitches / PA they are 100% current season. |
| Returning from long injury (1+ year) | Use last available season data with 20% shrinkage toward league average. Blend curve applies normally once current season data accumulates. |
| International signing (no MLB data) | Same as rookie — start on league average, blend toward current season as data accumulates. Consider suppressing signal until player has 200+ pitches / PA of current season data. |
| Mid-season call-up or trade acquisition | If prior season MLB data exists: bootstrap from it, blend normally. If no prior MLB data: treat as rookie — league average blending toward current season. |

### Output Flagging

- Games where any starter is on `prior_season` or `league_avg` data → add **LOW CONFIDENCE** flag to signal
- Games where all players are on `current_season` data → no flag
- Do not suppress signals — show them with the flag and let you decide whether to act
- By mid-May (~500+ pitches) most starters will be in `blended_late`. By All-Star break most regulars will be on `current_season`.

### New Profile Fields

Add `data_source` to both pitcher and batter profile schemas:

| Field | Type | Values |
|---|---|---|
| data_source | string | `prior_season` / `blended_early` / `blended_late` / `current_season` / `league_avg` |

---

## Configuration & Environment Variables

All API keys and configurable settings live in a `.env` file in the project root. Never hardcode keys in source files.

**`.env` file:**

```
# The Odds API — free tier, ~500 requests/month
ODDS_API_KEY=your_key_here

# OpenWeatherMap — free tier, sufficient for daily use
OPENWEATHER_API_KEY=your_key_here

# Model thresholds — adjust after backtesting
ML_EDGE_THRESHOLD=65
RL_EDGE_THRESHOLD=75
OU_EDGE_THRESHOLD=65
VALUE_EDGE_MIN=0.04

# Season
CURRENT_SEASON=2026
```

**Loading in Python:**

```python
from dotenv import load_dotenv
import os

load_dotenv()
ODDS_API_KEY = os.getenv("ODDS_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
```

Add `python-dotenv` to `requirements.txt`: `pip install python-dotenv`

Add `.env` to `.gitignore` — never commit API keys to version control.

---

## Output Delivery

`notify.py` prints the daily report to terminal (stdout) only. No email, Slack, or SMS integration. You read the output and decide what to do with it.

**Morning pass output:** Print to terminal. Preliminary signals, not confirmed lineups — for review only.

**Pregame pass output:** Print to terminal. This is the actionable report. Copy and send however you want.

**Format:** Plain text with clear sections — bet signals at the top, no-bet games below. Each bet signal shows all fields on separate labeled lines so it's easy to read and copy. Example:

```
============================================================
MLB MODEL — FINAL SIGNALS  |  Tuesday March 24  |  14 games
Thresholds: ML >= 65  ·  RL alert >= 75  ·  O/U >= 65  ·  Value >= +4%
Signals: 2 ML  ·  1 RL ALERT  ·  1 OVER  ·  11 no bet
============================================================

[BET ML] NYY @ BOS  7:10 PM ET
  Cole vs. Sale  ·  Fenway Park
  Edge score:     71  |  Bullpen: NYY 74  BOS 52
  Moneyline:      NYY -115
  Line implied:   53.5%
  Model prob:     61.0%
  Value edge:     +7.5%

[BET OVER] LAD @ SF  9:45 PM ET
  Yamamoto vs. Webb  ·  Oracle Park
  O/U line:       8.5  (-110 / -110)
  Model total:    9.3
  O/U score:      68
  Value edge:     +4.8%

------------------------------------------------------------
NO BET — 11 games

CHC @ STL  1:15 PM ET  ·  Steele vs. Mikolas  ·  Edge: 48  O/U: 52  Value: +2.1%
HOU @ TEX  8:05 PM ET  ·  Brown vs. Eovaldi   ·  Edge: 53  O/U: 44  Value: +1.5%
... (9 more below threshold)
============================================================
```

---

## Error Handling & Alerts

If a data source fails, the pipeline prints a clear alert to terminal and continues with whatever data it has. It never silently fails.

### Failure Rules

| Failure | Behavior |
|---|---|
| Statcast pull fails for a player | Print alert: `[ALERT] Statcast pull failed for {player_name} ({player_id}) — using cached profile from {last_updated}`. Use last cached profile if available. If no cache exists, use league average and flag as `league_avg`. |
| Statcast entirely unavailable | Print alert: `[ALERT] Statcast unavailable — all profiles using cached data from {date}`. Continue with cached profiles. |
| Odds API down or quota exceeded | Print alert: `[ALERT] Odds API unavailable — value edge check skipped for all games. Edge score signals shown without value confirmation.` Show signals based on edge score alone, clearly marked as UNCONFIRMED. |
| Odds API missing a specific game | Print alert: `[ALERT] No odds found for {home} vs {away} — value edge check skipped for this game.` |
| Weather API fails for a stadium | Print alert: `[ALERT] Weather unavailable for {stadium} — weather adjustment skipped for {home} vs {away}`. Skip weather adjustment, use raw park-adjusted score. |
| MLB Stats API unavailable | Print alert: `[ALERT] MLB Stats API unavailable — pipeline cannot continue without lineup and starter data.` Halt the pass and print instructions to retry. |
| No games today | Print: `No games scheduled today.` Exit cleanly. |

### Alert Format

All alerts print to terminal with a timestamp and are also appended to `logs/pipeline.log` so you have a record of failures:

```
[2026-03-24 10:03:41] [ALERT] Statcast pull failed for Gerrit Cole (592789) — using cached profile from 2026-03-23
[2026-03-24 10:04:12] [ALERT] Weather unavailable for Fenway Park — weather adjustment skipped for NYY @ BOS
```

Add `logs/` directory to project structure. Add `logs/pipeline.log` to `.gitignore`.

---

## results_log.csv Columns

One row per signal per game per day. If a game fires both an ML signal and an O/U signal, it gets two rows.

| Column | Type | Description |
|---|---|---|
| date | date | Game date (YYYY-MM-DD) |
| game_id | string | MLB game ID |
| signal_type | string | ML / RL_ALERT / OVER / UNDER |
| bet_side | string | Home team abbrev, away team abbrev, OVER, or UNDER |
| home_team | string | Home team abbreviation |
| away_team | string | Away team abbreviation |
| home_starter | string | Home starter name |
| away_starter | string | Away starter name |
| edge_score | float | Final adjusted edge score |
| ou_score | float | O/U directional score (blank for ML/RL rows) |
| home_bullpen_score | float | Home team bullpen score |
| away_bullpen_score | float | Away team bullpen score |
| data_confidence | string | NORMAL / LOW CONFIDENCE |
| moneyline | int | Moneyline for bet side at signal time (blank for O/U rows) |
| run_line_odds | int | Run line odds for bet side (RL_ALERT rows only) |
| ou_line | float | Over/under total at signal time (O/U rows only) |
| ou_odds | int | Moneyline for over or under side (O/U rows only) |
| model_prob | float | Model's estimated win/over/under probability |
| line_implied_prob | float | Book's implied probability from the line |
| value_edge | float | model_prob minus line_implied_prob |
| signal_version | string | morning / final |
| closing_line | int | Closing moneyline or O/U total (~5 min before first pitch) |
| closing_line_value | float | CLV — closing implied prob minus opening implied prob |
| result | string | WIN / LOSS / PUSH / PENDING |
| profit_loss | float | Units won or lost (based on standard -110 sizing unless noted) |
| notes | string | Free text — e.g. "starter scratched pregame", "LOW CONFIDENCE rookie starter" |

---



1. `src/fetch.py` — all data sources (Statcast, MLB API, odds, weather, game logs)
2. `src/bootstrap.py` — one-time opening day script to seed prior-season profiles
3. `src/profile.py` — pitcher and batter profile aggregation + seasonal blend logic
4. `src/bullpen.py` — team bullpen score (ERA/WHIP aggregation + workload + availability)
5. `src/score.py` — edge score + park/weather + bullpen modifier + O/U model total + O/U score
6. `src/signal.py` — ML/RL_ALERT/O/U threshold and value check logic + LOW CONFIDENCE flagging
7. `run_daily.py` — morning pass orchestration
8. `run_pregame.py` — pregame diff and re-score
9. `src/notify.py` — daily output report
10. `src/closing_line.py` — CLV tracking for ML and O/U (RL informational)
11. `src/backtest.py` — historical validation, three calibration curves

---

## Key Constraints & Guardrails

- Never score a game without a confirmed or probable starter
- Never fire a final signal without a confirmed lineup
- Both teams edge score >= 60 = NO BET on side markets; O/U can still fire independently
- RL_ALERT is informational only — no automated bet placed until win-by-2+ calibration curve exists
- The Odds API free tier is ~500 req/month — fetch all markets (h2h, spreads, totals) in a single call per game; do not poll continuously
- Statcast data for a given day is available the following morning — do not expect live game pitch data
- pybaseball has built-in caching — do not disable during backtesting
- O/U score baseline is always 50 — all factors always contribute; never use conditional bonuses that only fire above thresholds
- Net bullpen modifier uses both teams' scores (differential) — not a one-sided penalty on the pitching team alone
- Bullpen ERA/WHIP must be aggregated from individual reliever data (IP < 80 filter + active roster cross-reference) — do not use team-level ERA which includes starter performance
- `src/bootstrap.py` is run once before the first game of the season — it is not part of the daily pipeline
- Do not use spring training Statcast data for profiles — small samples against non-MLB competition make it unreliable
- LOW CONFIDENCE flag must appear in output whenever any starter has `data_source` of `prior_season` or `league_avg`
- `notify.py` prints to terminal only — no email, Slack, or SMS integration
- All API keys must be loaded from `.env` — never hardcode in source files
- `.env` and `logs/` must be in `.gitignore` — never commit to version control
- All pipeline failures print a timestamped alert to terminal AND append to `logs/pipeline.log`
- MLB Stats API failure is the only failure that halts the pipeline — all other failures degrade gracefully using cached data or skipping the affected adjustment
- If Odds API is down, show edge score signals marked UNCONFIRMED — do not silently skip them
