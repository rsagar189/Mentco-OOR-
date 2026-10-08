# Go-live checklist

Tick each box. "(me)" items are already done in the app; the rest are yours. Details are in the linked guides.

## A. Security and clean-up
- [ ] **New flow address.** The old one appeared in a chat. Power Automate → flow → **Save As** (makes a copy with a new
      address) → turn the copy on → put its address on the `const FLOW_URL` line → delete the old flow.
- [ ] **Delete the practice login** (`UAT Admin`) in the app's Users screen, and the three `POM_…` environment variables
      in the cloud environment settings.
- [ ] **Delete the 5 test rows** in `POM_AuditLog` whose text contains `UAT-` (the flow cannot delete audit rows).
- [ ] **Lock the SharePoint site**: you, one backup admin and the service account only. Do not add the app's users.
- [ ] **Turn on version history** for all `POM_` lists (list → Settings → List settings → Versioning settings).
- [ ] **Shared service account** owns the flow and the SharePoint connection; it has a Power Automate premium licence.
- [ ] **Failure email** on the flow (FLOW_UPGRADE step 3, item 1) and **a copy of the flow** (flow page → ⋯ → Export → Package).
- [ ] Spare Admin login created in the app and its password stored safely.

## B. Built into the app (me)
- [x] Failed saves show a red "NOT saved" bar with Retry; closing the tab warns if something is unsaved
- [x] Two people editing the same record get a warning (needs `FLOW_QUERY`)
- [x] Reads every page; warns if a list is cut off at 5,000 rows
- [x] Open orders + last 12 months at sign-in, older history on request (needs `USE_COLUMNS`)
- [x] Audit log loads 200 at a time
- [x] Warnings for duplicate PO numbers and over-shipping
- [x] Dropdown lists (locations, shipment types) editable by Admin (Master Data → Dropdown lists)
- [x] AI import buttons hidden; version number shown top right
- [x] Automated tests: `tests/uat/` (re-run before every update)

## B2. Flow hardening (docs/FLOW_HARDENING.md) — do BEFORE putting the page on the internet
- [x] Part A: `Email` column + index on `POM_Sessions`
- [x] Part B: lockout steps in the flow (real test: 9/9)
- [x] Part C: sign-out-on-change steps in the flow (real test: 12/12), `HARDENED_FLOW = true`
- [x] App-level real test through the screens: 14/14

## C. Scale set-up (FLOW_UPGRADE.md)
- [x] Step 1 done and tested on the real flow (`FLOW_QUERY = true`)
- [x] Step 2 done and tested on the real flow: columns added, flow updated, `USE_COLUMNS = true` (real-system UAT 89/89, window test 11/11)
- [ ] Press **Rebuild search columns** once after real orders exist from before the upgrade (Master Data → Dropdown lists)
- [ ] Step 3: session clean-up flow and weekly backup flow running

## D. Hosting
- [ ] `index.html` (with the new flow address and the switches set) uploaded to Cloudflare Pages / Netlify / Azure Static Web Apps
- [ ] Opened from another computer and signed in; refresh keeps you signed in; sign-out works
- [ ] A second "test" copy of the app + flow + lists exists for trying changes before they go live

## E. People
- [ ] Create a login for each person (Users screen): Admin / Staff / Viewer 1 / Viewer 2
- [ ] Two-to-three person pilot for a week; collect problems in a list
- [ ] One-page how-to per role; one-page runbook: add/remove/reset a user, restore from the weekly backup, who to call

## F. Known limits to accept
- Two people creating a *new* order at the exact same second could get the same internal number (very unlikely at 10–15 orders a day).
- Lockout after repeated wrong passwords is not built yet (use long passwords).
- Deleting a user does not end an already-open session (up to 12 hours).
- Staff "partial edit" limits and audit entries are still enforced in the browser, not in the flow.
- Dashboard totals cover loaded data only (open orders + 12 months, plus anything you load from history).
