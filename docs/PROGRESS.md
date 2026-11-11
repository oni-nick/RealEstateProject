# PLOT OS v2 progress log

## Step 1 — Data basis (2026-11-12)

### Done

- Created `docs/data-sources.md` and `web-v2/data/market_refs.json`: 10 districts, six metrics per district (60 rows), eight shared financing/deposit/cost assumptions and seven explicit UNKNOWN rows; 75 rows total.
- Included separate land/GFA purchase-price bands, 1F/upper-floor monthly rents, physical vacancy and forward NOI cap-rate bands. Jongno and Jung are separate; Gwangjin is the additional district.
- Every row has a unique id, value/range, unit, candidate source names/ids, exact `reference/approximate - verify` tag, low confidence, unverified status and assumption provenance. Source titles, URLs, publication/access dates and market observation dates are UNKNOWN. No sources were consulted and no web access was used.
- Documented rate/area conventions, refundable deposits, 4.6% demo tax allowance, brokerage/miscellaneous costs, lender fees, exclusions and a checked funding example. Bands are broad 2024–2026 model estimates, not verified November 2026 observations.
- Added Korean placeholder with `예시 데이터 · 실제 매물 아님` and a relative JSON link; prepared tracked CSS, JS engine, data, scripts and tests folders. Existing `.gitignore` already covers `verify/`; no ignore-rule change needed.

### Files

- `docs/data-sources.md`
- `docs/PROGRESS.md` (this appended section; existing UTF-8 BOM removed)
- `web-v2/data/market_refs.json`
- `web-v2/index.html`
- `web-v2/css/.gitkeep`
- `web-v2/js/engine/.gitkeep`
- `scripts/.gitkeep`
- `tests/market-refs.test.mjs`

### Commands and results

- Read `docs/PLAN.md`, `docs/context/step00-analysis.md`, `docs/PROGRESS.md` and `.gitignore`; read-only `git status --porcelain=v1 -b` confirmed `demo/plot-os-v2` with no initial changes. No paths linked to the main tree in the historical analysis were opened.
- Used the specified bundled Node (`v24.22.1`) and Node built-ins only; no installs, external requests, servers or git write commands.
- `node --test tests/` (using the full bundled executable path): blocked by sandbox child-process creation, `spawn EPERM`; no tests completed in that mode.
- `node --test --test-isolation=none tests/market-refs.test.mjs` (same executable): **8 passed, 0 failed**. Checks cover encoding/BOM and size, district/metric completeness and units, unique ids, ranges/defaults, candidate source integrity, UNKNOWN preservation, shared references, document/JSON consistency, funding arithmetic and placeholder/folder layout.
- An initial PowerShell-to-Node text pipe lost Korean characters. Direct UTF-8 file input corrected the affected data/documentation; checks reproduced the failure before correction and passed afterward. Temporary repair inputs were confined to ignored `verify/` and removed.
- `git diff --check`: passed. `git check-ignore verify/step01-check.txt`: matched the existing ignore rule. Deliverable paths did not match ignore rules (the expected `git check-ignore` result is exit 1).
- Final file inventory/UTF-8 size inspection and repeat test results are recorded in the step handoff. JSON remains below 200 KB and every created file below 1 MB.

### Known issues

- All market and financing values are deliberately unverified, low-confidence demo assumptions; source names are verification candidates, not citations supporting the endpoints. The checks validate the data contract and arithmetic, not market accuracy.
- Standard subprocess-isolated test mode is blocked in this sandbox; use the documented in-process command above. Placeholder UI has no application behavior yet and was not visually browser-tested.

### UNKNOWNs

- Actual observation/report dates and current November 2026 market levels, actual lender underwriting/rates/fees and transaction-specific tax treatment.
- Deposit/rent conversion interest rate, VAT treatment, itemized owner operating costs, basement rents and building-specific exclusive-area/GFA ratios.
- Real transaction, rent-roll, customer and owner evidence was not accessed or included. Subsequent steps need explicit building assumptions or verified inputs; UNKNOWN must not silently become zero.

## Step 2 — Deterministic mock data (2026-11-12)

### Done

- Built `scripts/generate-data.mjs` with a fixed string seed, FNV-1a/Mulberry32 PRNG, fixed snapshot date, Node built-ins only, and no network, clock-dependent inputs or external records. It reads the existing `market_refs.json` and writes only the named generated files under `web-v2/data/`.
- Generated **400 buildings** (40 per gu), **25 deep records**, **150 fictional comparable transactions** and **10 schematic gu polygons plus a rough Han river line**. All selected neighborhoods are represented. Asking prices span **30.03–149.98억 KRW**, land is 100–500 m², construction years are 1985–2022, and buildings have 3–8 above-ground floors with zero or one basement.
- Summaries include mock masked block addresses, explicitly fictional names, use mix, zoning, station association/walking time, status, days on market, motivation, area-weighted occupancy, operating income/expenses, refundable deposits, NOI, derived cap rate, illustrative income value band and deep-file links.
- Each deep file includes unit areas in m²/pyeong, potential and contracted rent, management fees, refundable deposits, tenant categories, lease dates, vacancy and renewal risk; five owner opex categories; two historical capex events; 5–8 nearby same-gu comp links with schematic distances; and three value-up notes with explicit budgets/downtime/uplift assumptions.
- Every numeric JSON leaf has an exact same-key provenance object on its containing record: kind, refId/formulaId/assumptionId and low confidence. `generation.json` documents units, formulas, synthetic assumptions, reference dependencies, file paths, accounting conventions and all seven unresolved reference UNKNOWNs. All files carry `예시 데이터 · 실제 매물 아님` and unverified status.
- NOI is derived from occupied contract rents plus collected management fees less owner expenses, without a second vacancy deduction. Deposits and historical capex are excluded from recurring NOI. Asking/comp prices satisfy the intersection of demo, land-price and GFA-price bounds; cap-rate bands do not manufacture rent or NOI.
- Added the consumer/schema contract in `docs/context/step02-data-contract.md` and eight behavior tests in `tests/data.test.mjs`. A separate read-only reviewer found no Critical or Important defects and independently confirmed price-band consistency.

### Files

- `scripts/generate-data.mjs`
- `tests/data.test.mjs`
- `web-v2/data/buildings.json`
- `web-v2/data/comps.json`
- `web-v2/data/districts.json`
- `web-v2/data/generation.json`
- `web-v2/data/deep/bld-*.json` (25 files)
- `docs/context/step02-data-contract.md`
- `docs/PROGRESS.md` (this appended section)

### Commands and results

All Node commands used `C:\Users\nicho\AppData\Local\OpenAI\Codex\runtimes\cua_node\6ef99b3d04073aa7\bin\node.exe`.

- `node --test --test-isolation=none tests/data.test.mjs` before implementation: failed with the expected `ERR_MODULE_NOT_FOUND`. New regression assertions subsequently reproduced fractional rounding tails and summary/rent-roll use disagreement; both passed after correction.
- `node scripts/generate-data.mjs`: exit 0; 400 buildings, 25 deep files, 150 comps, 10 gu; asking range 30.03–149.98억.
- Exact requested `node --test tests/`: blocked by sandbox child-process creation (`spawn EPERM`); no tests completed in isolated mode.
- `node --test --test-isolation=none tests/`: this runtime rejects the directory argument (`ERR_UNSUPPORTED_DIR_IMPORT`).
- `node --test --test-isolation=none tests/market-refs.test.mjs tests/data.test.mjs`: **16 passed, 0 failed**. Covers schema/counts, numeric ranges/units/provenance resolution, privacy/mock labels, polygon containment, rent/area/expense/NOI/deposit consistency, comp links/distances, fixed-seed byte identity, different-seed variation, input immutability and malformed/infeasible reference rejection, plus all existing reference tests.
- Independent Node built-in byte/hash inspection: all **29 generated JSON files** exactly match a fresh in-memory run. Largest is `buildings.json`: **991,431 bytes**; `comps.json`: **154,295 bytes**; `districts.json`: **18,373 bytes**; `generation.json`: **12,931 bytes**; deep files **11,452–23,159 bytes**. Every output is strictly below 1,000,000 bytes and UTF-8 without BOM.
- Five additional seeds (`a` through `e`) serialized successfully; summary sizes were 990,832–991,692 bytes. Serializer checks all file sizes before the CLI writes any outputs.
- `git diff --check`: passed. Read-only `git status` confirmed this is `demo/plot-os-v2`; no git write commands, installs, services, excluded data or main-tree paths were used.

### Known issues

- All data is fictional and low-confidence. Reference sources remain unconsulted verification candidates, not evidence supporting actual properties or transactions. Checks establish demo data integrity, not market accuracy.
- Geometry is deliberately schematic. Coordinates are jittered within the gu sketch; neighborhood/station associations and walk times are illustrative, not measured routes or real building locations. Only the ten selected gu are represented.
- Suite-level vacancy is discrete; realized area vacancy can differ from the reference envelope. Derived cap rates can fall outside reference cap bands; this is explicit and is not corrected by reverse-engineering rent. Value bands are unverified income illustrations, not appraisals.
- `buildings.json` is compact JSON to meet the size limit. Future schema expansion may require sharding; serialization rejects oversized output before writing.
- Standard isolated test mode is sandbox-blocked; the equivalent full set of test files passes in-process. No browser/visual verification was needed for this data-only step.
- Final review minor (deferred): automated tests cover global price bounds and NOI/cap arithmetic, but do not directly assert each district land/GFA band or the estimated-value formula. The reviewer independently checked all district price bands and found zero violations; the current value formula was reviewed in code. These optional assertions can be added with later engine/data-contract work.

### UNKNOWNs

- Current verified market observations, actual transaction/lease evidence, real floor areas/condition, routing distances, owner expenses and capex quotes.
- The seven existing reference UNKNOWNs remain unresolved, including VAT/tax treatment, deposit conversion rate, current market date, real owner opex, basement rents and exclusive/GFA ratios. Explicit synthetic building assumptions supplement the demo without replacing those UNKNOWNs.
- Actual lease renewal behavior, permitted use changes, lender underwriting and intervention feasibility require later verified evidence; no real customer, owner or tenant records were accessed.

