# Step 9 — One-click proposal implementation plan

**Goal:** Implement PLAN.md scene 5 as an offline, engine-backed buyer/seller A4 proposal.
**Architecture:** A pure proposal analysis module composes existing engine, pricing, value-up and comp selectors. A focused proposal view renders five printable sections and native SVG charts. Existing hash routes and evidence controls remain shared.
**Spec:** `docs/PLAN.md`, scene 5; user Step 9 instructions.

## Constraints and decisions

- Only this dedicated worktree; no git mutations, dependencies, network resources, real records, binaries or files above 1 MB. UTF-8 without BOM. Runner commits.
- Execute the supplied step directly within its cap; existing worktree and approved PLAN are authoritative. No new approval gate or worktree.
- Screen: responsive A4-like sheets. Print: A4 portrait, explicit section breaks, controls/shell hidden, repeating table headings, text appendix visible without opening details.
- Five sections: cover; executive summary/key numbers/risks; scenarios/charts; comps/asking-price explanation; evidence/assumptions/UNKNOWNs/disclaimer.
- Buyer range: conservative and baseline exact max-price ceilings, both capped at ask. Conservative = rate +1 percentage point, vacancy +5 points, zero rent growth, exit cap +0.5 points. Unavailable ceilings suppress the range; never use bounded/ambiguous values as exact bids. This is a demo negotiation convention, not a valuation.
- Seller: land-basis ask per pyeong vs raw comp min/median/max, premium/discount and buyer engine IRR at ask; unadjusted examples cannot substantiate a real asking price.
- Shared current Radar LTV and target IRR, minimum DSCR 1.2; baseline engine defaults and synthetic rent roll. Bid/value-up edits are not imported, with explicit disclosure.
- Broker defaults to `예시 중개사`, editable text with literal text rendering and retained across buyer/seller route changes in session. PLAN does not specify this literal, print/disclaimer Korean labels; use `인쇄` and `면책 고지` (implementation choices).

## Tasks

- [x] Write and run failing pure analysis tests: deep/summary adapters, bid range constraints, unavailable state, scenario costs, comp units, no comps, immutability.
- [x] Implement `web-v2/js/proposal.js`: `proposalAnalysis(building, deep, comps, options)` and evidence-bearing results; reuse engine without arithmetic changes.
- [x] Write and run failing DOM coverage for buyer/seller toggle, broker edit, native print dispatch, all sections/charts, picker/missing buildings, evidence controls and appendix.
- [x] Implement `web-v2/js/ui/proposal-view.js`, local SVG chart module, proposal stylesheet, print rules and route integration; retain `views.js` export for callers.
- [x] Run requested bundled `node --test tests/`; if sandbox blocks child processes, also run full explicit-file in-process suite. Review changes and audit encodings/sizes/relative assets. Attempt browser verification if available; do not claim it if unavailable. Stop temporary servers.
- [x] Append Step 9 progress, commands/results, issues and UNKNOWNs.

## Review focus

1. Failed/ambiguous IRR and infeasible/bounded prices remain unavailable, never zero or a fabricated range.
2. Deep proposal uses exact rent-roll/deposit/opex inputs, summary proposal clearly states absence of lease detail.
3. Comp land/GFA units stay distinct, absent comps do not produce a valuation.
4. Broker edits stay literal, persist across audience switch and appear in print text; print click uses `window.print()` once.
5. Appendix is printable content, with actual input/source identities, low confidence, exclusions and unresolved UNKNOWNs.

## Execution record

- Read supplied plan, analysis, progress and relevant engine/UI/data contracts. Initial `git status --short` was clean.
- Plan and review decisions are maintained here; final results live in `docs/PROGRESS.md`.
- Focused tests: 10 passed after the invalid-at-ask equity regression reproduced and was repaired. Preserve range evidence and suppress the recommendation if capping at ask leaves the positive-equity domain.
- Independent read-only reviewer found no confirmed findings; actual A4 pagination/font/clipping/browser print behavior was declined because browser host is unavailable. This remains a verification limitation, not a claim of visual correctness.
- Footer numbers identify sections (not physical printed pages); content flows instead of clipping to a fixed height. Print pagination can vary by browser/printer settings.
