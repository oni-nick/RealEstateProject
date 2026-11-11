# Step 6 — Max-bid calculator implementation plan

**Goal:** Implement PLAN scene 2 at `#/building/<id>/bid` using the existing pure engine and mock data.
**Architecture:** Pure `js/bid.js` composes engine results, two price policies and chart data. `js/ui/bid-view.js` owns stable controls and disposable updates. `js/ui/bid-charts.js` renders local accessible SVGs. Existing app routing mounts the new view.
**Tech stack:** Native ES modules, DOM, SVG, Node built-ins; zero dependencies.
**Spec:** `docs/PLAN.md`, scene 2; Step 3 engine contract.

## Constraints and decisions

- Work only in this dedicated worktree. No git mutation commands, installs, external resources, binary artifacts or real records. UTF-8 without BOM.
- Existing spec and requested implementation authorize proceeding; implement inline with tests first. No additional design approval or worktree creation needed. Runner owns commits.
- BUY = combined maximum at target IRR and minimum holding-bucket DSCR. WALK-AWAY = combined maximum at IRR floor and the same DSCR. Default target inherits Radar (8% initially), floor = max(0%, target − 3 percentage points) for nonnegative targets, or max(−99%, target − 3 points) for negative targets; minimum DSCR = 1.20. All three are visible editable example policies; floor cannot exceed target.
- Fixed LTV loan policy, engine acquisition costs and refundable deposit treatment remain explicit. A price can fail because of invalid equity or unavailable IRR even below a nominal ceiling; guidance checks current metrics too.
- Core metrics and both ceilings update on input. Sensitivity recomputes after a short debounce with a visible pending state and cleared stale output. Destroy cancels pending work.
- Deep records use the rent-roll adapter, others use summary inputs. Source is disclosed. No fallback conceals failed deep loading.

## Review focus

1. Cash/no-service financing must show DSCR as not applicable; unavailable IRRs cannot become BUY recommendations.
2. High vacancy/negative cashflow must not create fabricated price lines or numeric zero for null.
3. Slider/target edits must keep focus, update all dependent outputs, and cancel pending sensitivity on navigation.
4. Price ruler must include asks and policy ceilings outside the slider domain; overlaps must remain legible.
5. Cashflow aggregation must conserve initial, operating and exit cashflows; grid axes must match cell assumptions.

## Tasks

- [x] 1. Write/run failing `tests/bid.test.mjs`: engine equivalence, 400 buildings/25 deep, distinct/DSCR-bound ceilings, cash/null/negative-equity states, annual cashflow conservation and sensitivity orientation. Implement pure bid orchestration; run tests green.
- [x] 2. Extend existing minimal-DOM smoke with bid deep/summary/missing routes, all seven slider updates, target validation, evidence actions, reset and destroy. Observe failures, implement view/charts/styles/routing, run green.
- [x] 3. Run exact requested `node --test tests/`; if sandbox isolation fails, run explicit-file in-process full suite. Check HTTP subpath assets, encoding, size and git diff whitespace. Attempt browser inspection with available tools; disclose any unavailable verification.
- [x] 4. Review final diff against spec, fix material issues and append Step 6 done/files/commands/results/issues/UNKNOWNs to `docs/PROGRESS.md`.

## Execution ledger

- Pre-flight: engine functions already expose evidence wrappers and status; app context can inspect custom evidence; router already parses bid routes. Stable controls match the Step 5 pattern.
- Task 1: complete — six pure calculation tests observed RED (missing module), then GREEN; all-building input reconciliation and exact engine equivalence pass.
- Task 2: complete — minimal DOM extension observed RED, then GREEN. Corrected a missing nested-call parenthesis exposed by module-import smoke. Corrected a test assumption: rounded KPI text need not change for every slider edit; the integration check now asserts a new engine result with the exact edited assumption.
- Task 3: complete — requested directory command cannot resolve `tests` as a module in Node 24 even outside sandbox; all seven explicit test files pass both in-process and with normal isolated workers (83/83 at that point). 400 full bid analyses and 62 subpath HTTP assets verified; transient server closed.
- Review: fresh reviewer found no Critical/Important issues in focused code and 18-test validation. Browser visual/focus/screen-reader QA deferred because browser host is unavailable and native fallback could not establish URL confidence.
- Final: fixed negative Radar target integration — own review found Radar allows −20% while initial bid validation rejected negatives. Added pure + DOM regression, observed both fail, then expanded policy range to engine-supported −99%. Nonnegative default floors stay unchanged; negative defaults preserve a three-point buffer. This preserves inherited targets instead of silently changing them.
- Final verification: all seven explicit test files with normal isolated workers, 84 passed / 0 failed. Repeated 400-building/25-deep full analyses and all 62 HTTP asset checks after the fix; server closed. No deferred code findings, only unavailable browser verification.
