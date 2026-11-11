# PLOT OS v2 - Demo Build Plan (authoritative spec for every step)

## Goal
Tomorrow Nick meets partner S (licensed Korean real-estate broker). Show a working demo that gives brokers,
brokerage firms, and small/mid building buyers/sellers a clear UVP beyond Valuemap / Disco / Budongsan Planet.
Those products SHOW transaction data on a map. PLOT OS answers the next question:
"At what price should my client buy (or list), and how do I convince them?" -> it helps a broker WIN and CLOSE the deal.
Korean tagline idea (UI): "지도를 보는 도구가 아니라, 딜을 성사시키는 도구".
Users: broker (primary, uses it live in front of a client), brokerage-firm manager (pipeline), buyer investor, seller.

## Fixed stack (no network installs available; Node is not on PATH)
- Zero-dependency static SPA in `web-v2/`: index.html, css/, js/ (native ES modules), data/ (JSON, each file < 1MB).
- No build step, no CDN, no external fonts/tiles/APIs. System font stack: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif.
- Relative paths only so it works on GitHub Pages under a subpath. Hash router (#/radar, #/building/<id>, ...).
- Calc engine: `web-v2/js/engine/*.js` pure ES modules (no DOM) importable by Node tests.
- Tests: `tests/*.test.mjs` run with the Codex-bundled Node:
  & 'C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe' --test tests/
- Data generator: `scripts/generate-data.mjs` (seeded PRNG, deterministic) writes `web-v2/data/*.json`.
- Map: hand-made SVG of Seoul with simplified gu polygons + lat/lng -> x/y projection for building dots; pan/zoom via viewBox. No API key.
- Charts: hand-made SVG components.

## Data spec (ALL mock, labeled in UI: "예시 데이터 · 실제 매물 아님")
- `docs/data-sources.md` + `web-v2/data/market_refs.json`: per district reference levels for small/mid commercial
  buildings: price per pyeong (land basis and GFA basis), market rent per pyeong/month by floor type (1F retail vs upper),
  deposit-to-rent convention, vacancy, cap rate range, typical LTV, loan rate range (2025-2026 levels).
  Each row: id, value/range, unit, source names (e.g. MOLIT real-transaction system, Seoul Open Data Plaza,
  Korea Real Estate Board commercial rent survey, broker market reports such as Rsquare / JLL Korea / CBRE Korea /
  Realty Korea / Buildingroad), tag "reference/approximate - verify". Unknown -> "UNKNOWN". Never invent URLs.
- Districts (>= 9): Gangnam (Yeoksam, Nonhyeon, Sinsa, Cheongdam, Samseong), Seocho (Seocho, Bangbae, Yangjae),
  Songpa (Jamsil, Munjeong), Mapo (Hapjeong, Yeonnam, Seogyo, Gongdeok), Seongdong (Seongsu), Yongsan (Hannam, Itaewon),
  Jongno/Jung (Euljiro, Jongno, Myeongdong), Yeongdeungpo (Yeouido, Mullae), plus one more (e.g. Gwangjin or Gangseo).
- ~400 buildings (300-500): asking price 30억~150억 KRW (3.0 - 15.0 billion KRW); land 100-500 m2; GFA; floors B1-8F;
  built 1985-2022; use mix (근린생활시설 / 업무시설); zoning; asking price; estimated value band; cap rate; occupancy;
  NOI estimate; nearest subway station + walk minutes; status (매물 / 협의중 / 거래완료 참고); days on market;
  seller motivation tag; block-level FAKE address ("강남구 역삼동 8xx 일대"); clearly fictional building name.
  No real owner info, no real lot numbers. Coordinates jittered inside the district polygon.
  Every numeric field carries provenance: {kind: ref|derived|assumption, refId/formulaId/assumptionId, confidence: high|medium|low}.
- 25 deep buildings: unit-level rent roll (floor, unit, use, area m2 + pyeong, deposit, monthly rent, mgmt fee,
  tenant category such as "F&B 프랜차이즈", "의원", "IT 스타트업" - never real company names, lease start/end,
  occupied/vacant, renewal risk), opex breakdown, capex history, 5-8 nearby fake comps, value-up notes.
- ~150 comparable transactions approximating public transaction levels (fake addresses, block level).

## Calc engine spec (pure, documented, tested)
- 10y (configurable) monthly cashflow: rent, vacancy/credit loss, mgmt income, opex, NOI; loan (LTV, rate,
  interest-only or amortizing), debt service; acquisition costs (acquisition tax ~4.6% approx, brokerage fee, misc);
  deposits (보증금) reduce equity required; exit at exit cap with selling costs.
- Metrics: NOI, cap rate, cash-on-cash, equity required, DSCR, levered + unlevered IRR (Newton with bisection fallback,
  handle no-solution), equity multiple, payback.
- Max purchase price at target IRR (bisection on price) and at min DSCR; report which constraint binds.
- Sensitivity: rate, vacancy, rent growth, exit cap, capex -> IRR and max price (tornado + 2D grid).
- Value-up scenarios: lease-up, remodel (capex, downtime, rent uplift), use change (downtime + uplift);
  before/after NOI, value, IRR.
- Outputs carry {value, formula, inputs, provenance} for the evidence trace.

## Five hero scenes
1. Deal Radar (#/radar): investor criteria (equity 억, target IRR, LTV, districts, price range, use, max walk minutes)
   -> SVG map + list highlight matching deals with match score and "왜 맞는지" reasons; non-matching dimmed.
   Presets: "자기자본 30억 · IRR 8%", "강남 사옥용", "성수 밸류업". KPI strip: matches, median IRR, median 평당가.
2. Max-bid calculator (#/building/<id>/bid): live sliders (price, rate, LTV, vacancy, rent growth, exit cap, hold years)
   -> IRR, DSCR, equity; a price ruler with asking price vs BUY line (target IRR met) vs WALK-AWAY line
   (min DSCR / IRR floor); negotiation guidance text (e.g. "호가 대비 -6.5%까지 제안 가능").
3. Value-up simulator (#/building/<id>/valueup): pick interventions; before/after bars for NOI and value; IRR delta;
   downtime timeline; rent-roll heat strip by floor.
4. Evidence trace: any key number (dotted underline) opens a side panel: value, formula, inputs, source
   (market ref / rent roll / assumption), confidence badge, "검증 필요" flag. Global "근거 모드" toggle highlights
   low-confidence numbers.
5. One-click proposal (#/building/<id>/proposal?for=buyer|seller): A4 print layout via window.print + print CSS:
   cover, summary, key numbers, scenarios, evidence appendix, disclaimer. Buyer: recommended bid + risks.
   Seller: asking price justification vs comps + buyer IRR at ask.
Also: building overview (rent roll table, lease-expiry waterfall, comps), optional pipeline/deal board for firms.

## Design direction
Premium, calm, dense data UI (Bloomberg meets Linear): deep navy shell, light content cards, one accent color,
Korean typography, smooth transitions, tabular numbers, clear hierarchy. Responsive for 1280-1920 wide laptops.
No console errors. Works offline. Every page reachable from nav. Persistent "예시 데이터" badge.

## Process rules
- Keep `docs/PROGRESS.md` (append one section per step: done, files, commands run + results, known issues).
- `docs/DEMO_SCRIPT.md` (Korean) by the end. `docs/SUMMARY.md` written in step 11.
