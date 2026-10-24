# HAG-35 / HAG-27 — Integration Steward 2: build health, debris, collisions

Author: meredith-mvawxvej · 2026-10-18 13:05 SGT · HEAD `eaae1d7`

Scope: keep the tree buildable under concurrent committers, verify by real boot and HTTP probe, report debris with a delete verdict each. **I deleted nothing and made zero commits** — every modified and untracked file below belongs to another agent's in-flight work.

---

## 1. Build health — GREEN

| Gate | Command | Result |
|---|---|---|
| Syntax | `node --check` over all `find src -name '*.js'` | **217/217 clean, 0 failures** |
| Route handlers | `node /tmp/routecheck.js` | **all route handlers resolve** |
| Boot | `PORT=5002 node index.js` | **clean**: `Server running on port 5002`, `MySQL Connected`, `[PrintQueue] Print queue processor started` |
| HTTP probe | node `http.get` on 127.0.0.1:5002 | **9/9 correct** |
| Frontend build | `npx vite build --configLoader native` | **clean, 5.21s** |
| Frontend lint | `npx eslint src --quiet` | 171 lint errors, **0 parse errors** |

Counts unchanged from 2026-10-17: 46 controllers, 32 route files, 38 `app.use("/api…")` mounts, 217 backend JS files.

**HTTP probe detail** — all as expected:

```
200  /                        Backend Running
200  /api/health              {"status":"ok","message":"Backend is reachable"}
404  /api/nope-nothing        {"message":"Endpoint not found.","path":"/api/nope-nothing"}
401  /api/employees           {"message":"No token provided"}
401  /api/roles               {"message":"No token provided"}
401  /api/payroll             {"message":"No token provided"}
401  /api/inventory/stock     {"message":"No token provided"}
401  /api/inventory/transfers {"message":"No token provided"}
401  /api/banquet             {"message":"No token provided"}
```

The 401s are the auth guard, not 404s — those routes are mounted and live. `/api/banquet` is newly live since `ef0d1ae`/`eaae1d7` touched the banquet INSERT and account schemas.

### Live server left running

Floor restart had killed every previous instance (5 stale `node index.js` PIDs 39003, 55458, 56981, 59261, 60340 were holding nothing and all got `ECONNREFUSED` before I stopped them — they were already dead or orphaned). I relaunched one instance:

- **pid 62259**, started 2026-10-18 ~13:02 SGT, LISTEN on `*:5002`
- Log: `/tmp/mbt-backend.log`

---

## 2. Frontend lint: 171 problems, 0 parse errors

Grouped by rule (Vite 7 + the newer `react-hooks` eslint plugin):

| Count | Rule | Severity |
|---|---|---|
| 151 | `no-unused-vars` | lint noise, pre-existing |
| 7 | `no-empty` | lint noise, pre-existing |
| 5 | `no-undef` | lint noise, pre-existing |
| 1 | `no-constant-condition` | lint noise |
| **4** | **`react-hooks/rules-of-hooks`** | **real bug** |
| **2** | **`react-hooks/static-components`** | **real bug** |
| **1** | **`react-hooks/purity`** | **real bug** |

The last three are **runtime-impacting**, not noise. Not mine to fix (outside build-health scope), flagged for their owners:

- `components/Hotel/CollectPayment.jsx:42-45` — four `useState` calls inside a conditional branch. Hooks called conditionally violate the Rules of Hooks and will throw or silently desync state after the first render that skips them. **Most likely to cause a real user-facing bug.**
- `components/Housekeeping/Housekeeping.jsx:433,495` — components defined inside render, so their state resets on every parent render.
- `components/Header/Header.jsx:286` — `Date.now` called during render (impure), so a timestamp can drift between renders in the same commit.

### `printKot.js:42` — still open

`src/utils/printKOT.js:42` uses `require` in an ESM module. Not a parse error (so `node --check` and Vite both miss it); it throws at runtime the first time that code path prints. Owned by the HAG-26 / creed-mvawxs4s print area.

### Chunk warning — stable

`index-CbdTMRuP.js` 3,833.45 kB (gzip 983.64 kB), over the 500 kB warning limit. Byte-identical to the previous build; no change since 2026-10-17.

---

## 3. Tracked status (the specific question)

**`.DS_Store` — 2 of 3 ARE git-tracked:**

| Path | Status |
|---|---|
| `.DS_Store` (repo root) | **tracked**, modified this session |
| `Maa-Baglamkhi-Resort-Backend/.DS_Store` | **tracked**, modified this session |
| `Maa-Baglamkhi-Resort-frontend/.DS_Store` | untracked, correctly gitignored |

There is **no `.gitignore` rule for `.DS_Store`**, which is why the two are tracked and why they churn in every commit. Fixing this changes tracked-status for two files — a decision, not something I do unilaterally.

**`src/uploads` — 66 of ~149 invoice PDFs ARE git-tracked.** All 66 sit in `src/uploads/invoices/`. `src/uploads/document-*.png` is not tracked at all. The tree now holds 83 untracked files under `src/uploads` (77 of them invoice PDFs). `/uploads` is not in `.gitignore`; only `src/uploads/thermal/` is excluded. So new invoice PDFs land untracked until someone decides to `git add` them.

**`src/assets.zip`** — `Maa-Baglamkhi-Resort-frontend/src/assets.zip` is **git-tracked**, 1.09 MB binary, referenced by nothing in the frontend source. This is the one debris item with a real diff footprint.

No non-code files are tracked anywhere in the backend; the frontend's only non-code tracked files are `.DS_Store`, `assets.zip`, and the invoice PDFs listed above.

---

## 4. Debris — verdicts, nothing deleted

All verdicts are **SAFE to delete**. Nothing was deleted; every one of these is either a decision for god or owned by another agent.

### Git-tracked (deletion is a real commit, not an `rm`)

| Path | Size | Verdict |
|---|---|---|
| `_diag-verify-fk.js` | 912 B | **SAFE** — dotenv+fetch probe against `127.0.0.1:5002/api`, required by nothing |
| `_diag-state.js` | 1036 B | **SAFE** — `console.table` DB scratch, unreferenced |
| `_diag-add-deluxe.js` | — | **SAFE** — same class, unreferenced |
| `_diag-catalog.js` | — | **SAFE** — same class, unreferenced |
| `_diag-catalog2.js` | — | **SAFE** — same class, unreferenced |
| `_diag-legacy.js` | — | **SAFE** — same class, unreferenced |
| `otherBooking.jsx` (frontend root) | 0 B | **SAFE** — the real file is `src/components/Hotel/otherBooking.jsx`, imported by `BookingFlow.jsx` |
| `event.stopPropagation()}` (frontend root) | 0 B | **SAFE** — a 0-byte **file**, not the directory the earlier card claimed; shell-quoting accident |
| `src/assets.zip` | 1.09 MB | **SAFE but flagged** — only item with real diff footprint; needs a yes/no |
| `.DS_Store` ×2 | — | **SAFE + add a `.gitignore` rule** — they churn every commit |

### Untracked scratch (never committed, so a plain `rm`)

`_god-probe-shapes.js`, `_god-probe-shim.js`, `_hag210-probe.js`, `_ryan-probe-attend.js` … `_ryan-probe7.js`, `_phyllis-hag8/`, `_probe_reports.js`, `_transfer.js`, `_transfer2.js`, `_chk.js`, `_diag-mine.js`, `_probe.js`, `_diag-tmp/`, `test-results/`, `.done/` — all **SAFE**, all self-identified agent probes that clean up after themselves. Named after their authors, so deletion is theirs to make.

**Not scratch, do not remove:** `test/month-boundary.test.js`, `test/reports/api-routes.json`, `test/lifecycle.test.js`, and `reports/` — these are intentional test fixtures and sibling agents' stewardship reports.

**`board.md` at repo root** — untracked, and it is the hive's shared plan file. Leave it.

---

## 5. Merge collisions

**None found.** `git status` showed zero `UU`/`AA`/`DU` entries and no conflict markers in any modified file. No two-way conflicts to arbitrate.

---

## 6. Open items for god — decisions, not work

1. **`.gitignore`**: add `.DS_Store` (and `/uploads`?) — changes tracked-status of 2 files. Needs approval.
2. **`src/assets.zip`**: 1.09 MB tracked, unreferenced. Delete or keep?
3. **Employee/payroll frontend wiring**: backend is fully tracked and mounted; `/api/employees` and `/api/payroll` still have **zero** frontend callers, and `/api/roles` is called exactly once from `src/pages/Payroll.jsx`. Four payroll routes are reachable only by hand. Owner needed, or confirm this is deliberate dead surface.
4. **Frontend hooks bugs** in §2 (`CollectPayment.jsx` most urgent) — outside my scope, needs owners.

## Files I touched

None in the repo. Zero commits. The only writes this session are `/tmp/routecheck.js`, `/tmp/eslint.json`, `/tmp/mbt-backend.log` (all outside the repo) and one correction to my own `memory.md` sandbox note.
