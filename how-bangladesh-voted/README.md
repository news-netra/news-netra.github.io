# How Bangladesh Voted — the 2026 election, counted from the ground up

The integrative account of Bangladesh's February 2026 election: the result, village/town/city,
age, the women's vote, the minority vote, and the local-election map — built from the
centre-level official count joined to the fully decoded 125.1-million-row voter roll.

**Serve over HTTP** (fetches `data.json` + three topojson layers):

```bash
python3 -m http.server 8000
```

## The correction at the centre of this piece (2026-08-02)

An earlier version reported the **seat-level** correlation between a constituency's minority
share and Jamaat's vote (≈ −0.08, near zero) and concluded that the assumption minorities vote
against Islamist parties "did not show up in the count". **That was an aggregation artefact.**

Jamaat's strongest seats sit in Bangladesh's most Hindu districts, so a seat average cancels
two opposite things — a Muslim-majority electorate voting heavily *for* Jamaat and a minority
electorate voting heavily *against* it — and returns roughly zero. Re-running the same question
at **union level with constituency fixed effects** (each union compared with the others in its
own seat) gives:

| minority share × vote | between constituencies | **within constituencies** |
|---|---|---|
| Jamaat | −0.13 | **−0.37** (slope −0.36 pts per pt, CI −0.41/−0.31) |
| BNP | +0.06 | **+0.26** (slope +0.25) |
| Turnout | +0.06 | +0.05 (not significant) |

Strongest **inside Jamaat's own territory**: within the Khulna belt −0.63, in Jamaat-won seats
−0.45. Minority neighbourhoods opposed Jamaat hardest exactly where it was strongest — and were
outnumbered by the Muslim-majority unions around them, which is why the seat total showed
nothing. Two further consequences: the age–turnout relationship also reverses (between-place
−0.37 → within-seat +0.13, so it is regional composition, not young voters staying home), and
Chapter 2 now quantifies *why* this happens at all.

## Chapters

1. **The result** — 209 BNP / 66 Jamaat / 22 others on 297 declared seats; winner map;
   votes-vs-seats disproportion by coalition.
2. **Forty-two thousand elections** — the centre-level chapter that justifies everything after
   it. **Jamaat contested only 225 of 297 seats**, so every party statistic is conditioned on
   contestation (ignoring this inflates its "regional" variance share from 50% to 81%).
   Symmetric BNP/Jamaat: ~**half** of each party's centre-to-centre variation lies *within*
   constituencies (Jamaat 50%, BNP 49%; turnout 29%). Median within-seat spread 25.5 pts for
   Jamaat, 26.0 for the BNP; Khulna-6's own centres run 19%→75%. BNP has strongholds
   (12.2% of its votes from centres above 70%) and Jamaat almost none (2.4%).
3. **Village, town and city** — coalition shares by settlement type and the turnout cliff
   (60.5% villages → 46.1% big cities).
4. **The first-time nation** — median voter age 41; **36.1% of the roll was too young to have
   voted in December 2008** (~44M first-time-eligible voters); youth map; weak seat-level
   age–vote relationships, stated as such; the registered-at-home signature (city rolls are
   *older* than village rolls: 29% vs 35% under-35).
5. **The women's vote** — condensed from the companion piece (`../women-vote/`), same-building
   test by settlement type.
6. **The minority vote** — name-inferred religion for all 122.3M unique voters (90.5% Muslim,
   8.4% Hindu, 0.9% indigenous; 0.07% unresolved); seat map, then a **4,280-union choropleth**
   showing minority pockets and their vote as deviations from their own constituency — the two
   views invert. Carries the correction above; all three CHT seats went BNP.
7. **The local map** — 2026 votes inside 5,824 local leaderships (4,539 unions, 491 upazilas,
   319 pourashavas, 463 CC wards, 12 CCs); Jamaat ≈37% of votes → ≈25% of units at every tier.

## Method highlights

- **Age layer**: roll rows routed to constituencies by the district/upazila recorded *inside*
  each source PDF (folder labels are unreliable — one "নড়াইল-৪" folder contains Natore-4);
  deduped to the same 122,272,709-voter universe as the religion layer; verified 292/292
  against it with 0.00% max difference.
- **Guard**: 8 seats where roll and register diverge >15% are excluded from all seat-level
  statistics (280 seats in every correlation); 9 seats lack roll data entirely.
- **Verification, stated precisely**: the local-tier table was recomputed independently from
  the raw count by a separate pass — unit counts (463 / 4,539 / 491) reproduce exactly, and
  leader splits reproduce under the map's bloc convention (KM counted as its own bloc; the
  raw-CSV coalition column pools it with the Jamaat-led side, which shifts ~14 union units).
  The routed age layer matches the independently built religion layer 292/292 with 0.00%
  per-constituency difference. The upazila crosswalk is size-validated against the register
  (r = 0.98, 479/491 matched). National, settlement and women's figures come from the same
  scripts that produced the companion piece, whose headline numbers were bootstrap-verified
  there; they are one pipeline, cross-checked internally, not independently replicated.
- **Union layer**: roll re-aggregated by the district/upazila/union recorded *inside* each PDF,
  matched to English election units within each validated upazila (transliteration + size
  scored). 4,325 of 4,539 unions matched (95.3%), size r = 0.954, median roll/register 1.01;
  4,281 survive the ratio guard, across 267 constituencies. Religion uses the project's own
  classifier (0.07% unresolved). **City-corporation wards excluded** — a CC spans many thanas,
  the attempted match scored r = 0.23, i.e. wrong; municipalities not attempted.
- **Within-constituency estimator**: each union compared with the electorate-weighted mean of
  the other unions in its own seat (seats with ≥4 matched unions); intervals resample whole
  constituencies 1,000×.
- **Contestation guard**: party-specific centre statistics cover only seats that party
  contested (Jamaat 225/297, BNP 288/297).
- **Turnout** = valid votes / registered (conservative; with rejected ballots: 60.2%).
- **Privacy**: all roll-derived outputs are constituency-level aggregates or coarser.

## Files

| File | What |
|---|---|
| `index.html` | The story — six scrollytelling scenes, 15 charts, 4 interactive maps (incl. the 4,280-union choropleth), light/dark |
| `data.json` | Every number the page renders, including the upazila layer and scatter |
| `crosses.json` | The cross-matrix: women's gap × place/region/faith/age/competitiveness, rejected ballots × sex, turnout × sex × place, age × faith grid |
| `seats_full.csv` | Per-seat: result, turnout, age structure, minority share |
| `centres.json` · `centres_full.csv` | Centre layer: variance decomposition, distributions, within-seat spreads, all 42,382 centres |
| `within.json` · `units_full.csv` | The between/within test and the 4,281 joined unions |
| `unit_layer.json` | Union choropleth keyed to `units.topojson` |
| `upazilas_roll.csv` | The 467 matched upazila units: age, faith, result, turnout |
| `constituencies.topojson` · `upazilas.topojson` · `units.topojson` | Map layers (winners baked in) |

Two findings unique to this page's cross-matrix: **women's ballots were rejected 0.92 points
more often than men's** (2.58% vs 1.66%, CI 0.83–1.01, significant in villages, towns and
cities separately), and **women's ballots aside, the sharpest new result is the union-level
minority finding above** — which only exists because the roll was re-aggregated below
constituency level.

Companion: [`../women-vote/`](../women-vote/) — the full women's-vote analysis.
