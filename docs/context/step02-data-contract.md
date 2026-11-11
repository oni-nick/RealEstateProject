# Step 2 mock-data implementation contract

Spec: `docs/PLAN.md`, Data spec. All output is example data, not observed listings.
User constraints override workflow defaults: use the existing worktree, do not commit,
do not install packages, and finish this bounded step without design approval pauses.

## Design and consumer interface

- `scripts/generate-data.mjs` exports `generateData(refs, {seed})` and
  `serializeData(dataset)`; its CLI reads `web-v2/data/market_refs.json` and writes
  only named generated JSON files beneath `web-v2/data/`.
- Default seed is a fixed string, snapshot date is `2026-11-12`; no current clock,
  network, subprocess, external dependency or real property records are used.
- `buildings.json` has `{schemaVersion, metadata, buildings}` with 400 summaries.
  Numeric leaves stay convenient plain numbers, with an exact parallel `provenance`
  map on each record (`lat`, `lng`, `askingPriceKrw`, etc.). Each entry contains
  kind, the corresponding refId/formulaId/assumptionId, and low confidence.
- `deep/<building-id>.json` contains one detailed record for each of 25 summaries.
  Each nested numeric record has its own provenance map. Details include rent roll,
  expenses, capex history, 5–8 nearby comp links, and value-up notes.
- `comps.json` has 150 independently fictional transactions; `districts.json` has
  ten simplified gu polygons and a rough Han river polyline. Coordinates are
  `{lat, lng, provenance}` objects; never verified geographic boundaries.
- `generation.json` defines assumption/formula ids, units, source reference ids,
  numeric conventions and file paths. Reference draws cite the existing row id
  with low confidence; derived values inherit low confidence. UNKNOWN reference
  fields remain UNKNOWN; basement rents, exclusive-area ratios and opex receive
  separate explicit synthetic assumptions.
- Rents and owner expenses determine NOI and cap rate. The cap-rate reference
  band is a plausibility comparison, never a target used to manufacture income.
  Occupied contract income is not reduced by vacancy twice; vacant units have
  zero contracted income/deposit and separate potential rents. Deposits are
  refundable liabilities, excluded from NOI. Area-weighted occupancy is exact.
- All names explicitly contain `가상`; all addresses use masked block tokens such
  as `8xx 일대 (가상 블록)`. Station names are geographical labels; walking times
  and station associations are illustrative, not routing results.
- JSON is compact UTF-8 without BOM to keep all 400 summaries in one file under
  1,000,000 bytes. Serialization rejects any oversized file before writing.

Parallel provenance was chosen over numeric wrappers to keep the summary file
small and downstream arithmetic simple. One deep file per building avoids a
large initial download and allows later detail views to load on demand.

## Implementation and verification checklist

- [x] Write `tests/data.test.mjs` before the generator and observe a missing-module
  failure with the bundled Node in-process test mode.
- [x] Implement seeded generation, schematic geometry, mutually consistent summary
  and detailed accounts, fake comps, evidence registry and safe CLI writes.
- [x] Run the generator and contract tests: schemas, unique ids, requested counts,
  30–150 eok prices, 100–500 m² land, 1985–2022 years, B1–8F bounds, provenance
  resolution for every numeric leaf, polygon containment, rent/opex/NOI/deposit
  arithmetic, nearby comp links, seeded repeatability and byte-size limits.
- [x] Run the exact requested `node --test tests/`; subprocess isolation is
  blocked (`spawn EPERM`). In-process mode also rejects a directory argument
  (`ERR_UNSUPPORTED_DIR_IMPORT`), so enumerate both test files explicitly:
  `node --test --test-isolation=none tests/market-refs.test.mjs tests/data.test.mjs`.
- [x] Review output counts, min/max prices and byte sizes; check generated disk
  bytes against a second in-memory run; run `git diff --check`.
- [x] Append Step 2 results, commands, limitations and UNKNOWNs to `docs/PROGRESS.md`.

Known limits: mock market calibration, schematic gu geometry, and simple synthetic
leases/expenses are suitable for demo behavior only. No claim of real market,
parcel, owner, lender, tax or tenant accuracy is made.

## Execution notes

- Test-first generation check failed with `ERR_MODULE_NOT_FOUND`, then passed
  after implementation. Final data tests include the original acceptance checks
  plus input immutability and rejection of invalid/infeasible reference bands.
- Review regression tests reproduced decimal tails caused by multiplying an
  integer by a fractional quantum, and an independent random summary use label
  that disagreed with the rent roll. Decimal rounding now divides by an integer
  scale; summary use is derived from unit uses. Both regressions passed afterward.
- Full suite: 16 passed, 0 failed using the explicit in-process command above.
- 29 generated files match fresh in-memory generation byte-for-byte. Largest is
  `buildings.json`, 991,431 bytes; default asking prices 30.03–149.98억 KRW.
- Five further seed variants serialized successfully below 1,000,000 bytes.
- Integration is left to the runner; no git write commands were run.
