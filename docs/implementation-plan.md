# Offline React/TanStack rewrite

Status: implementation integrated and verified locally; ready for review.
The hard offline boundary in AGENTS.md applies to every workstream.

## Interactive planning board — authorised follow-up

The user approved a React Flow/Motion prototype with inline creation, spatial
planning and validation visible before the PISA page. The prototype is integrated
with the local model so interaction review uses real application behaviour and
wholly fictional fixtures.

- Root: React Flow canvas, custom inline-editable cards, directed edges, Motion,
  viewport controls, correction panels and browser review.
- Board model stream: optional layout positions, deterministic historical-file
  defaults, central validator-to-card mapping including shared/generated PISA
  provenance. Layout is excluded from PISA signatures.
- History/testing stream: shared 30-step session undo/redo, transaction safety,
  native graph keyboard tests and measured-node focus checks.
- Panel stream: nonmodal people and person editing, focus management, combined
  filters and protection against overwriting concurrent edits on the board.

Acceptance includes immediate creation without a dialog, Enter/Escape inline
editing, drag and click/keyboard movement, click/drag connections, persisted
positions, actionable card-level conflicts, quiet incomplete cards, immutable
archives, reduced motion and a self-contained network-blocked build. The user
reviews the interaction before further visual refinement. No deployment is part
of this prototype delivery.

Prototype verification: 162 application tests and 8 Python oracle tests pass;
strict types, Biome and production release/network-blocked startup checks pass.
Browser review on an isolated local origin covers inline creation/focus, click
connections, free dragging and restored positions, visible validation, correcting
a fictional excluded person from its card and undoing that correction. Direct
file:// launch retains the browser-tool limitation documented below.

Interaction review follow-up: graph movement now owns its transient node state
inside PlanningCanvas, including measured dimensions and drag state. Pointer
frames do not rerender the surrounding planning page or the card forms; the
completed gesture persists one undoable edit. Graph options and callbacks are
stable. Editing flyouts overlay the viewport without resizing or recentering it,
and focus restoration avoids scrolling. A header X asks for confirmation before
removing a group, its assignments and connections; people remain in the project.
Regression tests cover unchanged viewport/focus on flyout open/close, no card
content renders or storage writes during pointer frames, one save on release,
undo, cancellation/confirmation and archive protection. Browser checks use a
separate origin with fictional data only.

## Product acceptance

- One board for creating detachement cards, selecting people with combined
  filters, assigning remaining people, and connecting cards. Details are optional
  until preparing PISA. Connections are directional service progression.
- Planning groups remain understandable; PISA main/extra combinations are derived
  without duplicating editable planning cards. Shared details have one source.
- PISA preview follows PAT field order and displays exact direct-person lists.
  KVK/WK interpretation is explicitly KF-confirmed per service; unresolved plans
  remain labelled and cannot be marked verified. Generated EC choices persist.
- Local PISA/MILO import, legacy JSON compatibility, contact CSV, immutable local
  archives, person lookup, and data-bearing offline HTML export remain available.
- React with TanStack Router, Table, Form, and Store where appropriate; strict
  TypeScript 7, Vite, Vitest, formatting/linting, lockfile, CI and MIT licence.
- No runtime third-party requests or data transmission. Data-free production
  artifacts and local exports must work with networking unavailable.

## Parallel workstreams

1. Domain agent: `src/model/` and domain tests. Typed v5 model, safe legacy
   migration, assignments/connections, deterministic PISA derivation, validation,
   signature invalidation and archival safety. No UI, package or storage edits.
2. Interface agent: `src/components/`, `src/pages/PlanningPage.tsx`,
   `src/pages/PisaPage.tsx`, `src/theme.css`. TanStack selection table and forms,
   planning cards, connected groups, PAT-inspired handover. Uses shared contracts.
3. Tooling agent: package/config/build files, CI, privacy/build tests, MIT licence.
   Install pinned stable libraries, self-contained output, CSP, quality gates.
4. Root integration: app/store/router, local I/O, import/contact/person/archive
   pages, contributor docs, integration tests and browser verification.

## Integration and delivery order

1. Freeze shared model/store contracts, implement independent workstreams.
2. Integrate with strict type checking; remove obsolete global-script scaffolding
   once parity is covered. Do not leave two competing implementations.
3. Run domain and interaction regressions, historical-file compatibility checks,
   offline/privacy/build checks, and the existing Python oracle tests.
4. Inspect the production UI using fictional data only. Exercise import, planning,
   connections, PISA, contacts, archive/reopen and offline export/re-import.
5. Review the final diff and update architecture/contributor documentation.
   Finish a coherent, reviewable branch; no partial production deployment.

## Integrated result

- All four workstreams are integrated. The old global scripts, vendored XLSX
  bundle, concatenation builder and VM-based tests have been replaced.
- Strict types, formatting/lint, domain/UI/I/O/storage/privacy regressions and
  Python oracle checks are quality gates. Production HTML is self-contained,
  carries application/dependency licences, removes console output and uses CSP.
- Browser checks use an isolated localhost origin and wholly fictional records.
  Direct file:// navigation is blocked by the browser automation policy; a
  double-click launch remains a manual user-browser check. The generated HTML
  is separately executed with network APIs blocked during build verification.
- Scope limits: one onward connection per group, no connection chains; legacy
  explicit cohorts are preserved rather than silently merged. These limits are
  surfaced as validation messages and documented in the README.

## Verification result — 22 September 2026

- Strict TypeScript and Biome checks pass; 97 Vitest tests and all 8 Python
  oracle tests pass. Production build and its release/network-blocked startup
  checks pass. Git whitespace checks pass.
- Browser checks cover fictional CSV import and mapping, person allocation,
  connected cards, PISA policy selection, persistent contact selection, archive
  lookup, read-only archives and reopening a separate working copy.
- Offline HTML embedding and re-export are covered by automated tests. The
  browser tool did not report a download event for the HTML export, and blocks
  file:// navigation. Download completion and double-click launch remain manual
  browser checks; these are not claimed as verified browser behaviour.
- Changes remain local on `codex/typescript-modules`; no production deployment.
