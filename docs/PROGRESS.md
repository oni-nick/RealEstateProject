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

