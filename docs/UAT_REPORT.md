# PO Manager — UAT Report

**Date:** 2026-10-07 · **Build:** branch `claude/app-hosting-sharepoint-lnepc4` (latest `index.html`)
**Tested against:** the REAL Power Automate flow and REAL SharePoint site (`PO-Manager`), driven through the real screens in headless Chrome.
**Result: 89 checks, 89 passed, 0 failed** (182 calls to the live flow, 313 s). Test data was prefixed `UAT-` and removed afterwards.

## 1. What was tested and the result
| Area | Checks | Result | Highlights |
|---|---|---|---|
| Sign-in & sessions | 8 | Pass | wrong password / unknown email refused; refresh keeps you in; sign-out clears the saved login |
| User management | 9 | Pass | Admin creates users with any email (Gmail etc.); passwords stored only as a hash; duplicates, blank password refused; role and password changes work; cannot delete yourself |
| Master data | 5 | Pass | customers/parts saved; duplicates blocked; edit updates the same row (no duplicates); apostrophes, `&`, `<b>` stored exactly |
| Purchase orders | 9 | Pass | 3-step wizard saves; order row has **no rates**, rates live in `POM_Finance`; edit updates same row; short-close / cancel line maths right; CSV export downloads |
| Shipments | 5 | Pass | in-transit → delivered updates the order (40 delivered / 0 in transit); still right after refresh; delete returns quantities |
| Dashboard | 1 | Pass | PO values match a hand calculation (shown as $1.8K / $1.1K) |
| Roles (Staff, Viewer 1, Viewer 2) | 24 | Pass | right buttons/menus per role; Viewer 1 sees no rates or finance cards; Staff cannot delete or open Master Data/Users |
| Server-side security | 21 | Pass | with the browser bypassed, Viewer/Staff direct delete, user-list read, finance read (Viewer 1), master-data create were all refused by the flow; no token / forged token → 401; even Admin cannot read the sessions list |
| Data handling | 4 | Pass | two people saving different orders at once; 2,500-character note; Japanese/accents/quotes survive reload |
| Audit | 1 | Pass | entries written to `POM_AuditLog` |
| Clean-up / JS errors | 2 | Pass | no UAT data left in orders/shipments/parts/finance; no JavaScript errors |

**Bugs found in the app by UAT:** none that blocked a test. (During setup we fixed several earlier: user edits not saving, user id collisions, stale "memory only" notice, `Id` vs `ID` from SharePoint, flow-address placeholder confusion.)

## 2. Left behind by the test (please tidy)
- `POM_Users`: the practice **UAT Admin** row → delete it (and its password is in the environment variables → delete those too).
- `POM_AuditLog`: **5 test rows** (they contain `UAT-`) → delete in SharePoint; the flow deliberately cannot delete audit rows.
- `POM_Sessions`: a few test sessions (expire on their own after 12 h; delete rows if you like).
- `POM_Customers` shows 2 rows that are not from this test (your own earlier tests) → left untouched.

## 3. NOT covered (so not proven)
Offline / failed save (DAT-4) · two people editing the **same** order · shipment re-link, "Cancel PO" button and dashboard filters · Viewer 1 CSV export has no rate columns (ROL-9) · audit CSV export · over-shipping and duplicate PO numbers (ORD-8, SHP-6) · 100+ orders / speed · phone/tablet screens and browsers other than Chrome · how it looks (layout/accessibility) · AI PO import (known broken) · what happens at the 12-hour expiry · hosting (the page has not yet been put on a web host).

## 4. Improvements required
### A. Before go-live (do these)
| # | Item | Why | Who / effort |
|---|---|---|---|
| A1 | **Replace the flow address** with a fresh one and put it in the page you host | The current one was pasted in chat and is in a settings page | You, 15 min |
| A2 | **Delete the UAT Admin user, the 3 environment variables, test audit rows** | Practice credentials must not live on | You, 5 min |
| A3 | **Lock down the SharePoint site** (owner + service account only; do not add app users) and turn on **list version history** | Password hashes sit in `POM_Users`; versioning gives you undo/recovery | You, 10 min |
| A4 | **Silent save failures** — saves run in the background; if one fails (network, flow down, session expired) the screen still looks saved and only the browser console shows an error | Real data-loss risk | Me, ~1 h (show a red banner, keep a "not saved" flag, retry) |
| A5 | **Host the page** (Cloudflare Pages / Netlify / Azure Static Web Apps) and test once from a different computer | Only tested from a local file | You, 30 min |
| A6 | **Hide or fix the AI PO import button** | It shows but cannot work (needs an API key kept in the flow) | Me, 10 min to hide / 2–3 h to build properly |
| A7 | **Run-failure alert**: turn on Power Automate's failure email for the flow, and keep the flow owned by a shared account with a premium licence | If the licence lapses or the owner leaves, the whole app stops | You, 10 min |

### B. Soon after go-live
| # | Item | Why |
|---|---|---|
| B1 | **Login lockout / slow-down** after repeated wrong passwords | Currently unlimited guesses (use long passwords meanwhile) |
| B2 | **Check the user still exists on every request**; clean expired rows from `POM_Sessions` with a daily flow | A deleted user's open session lasts up to 12 h; sessions table grows forever |
| B3 | **Audit entries written by the flow, not the browser** (user name/role taken from the session) | Today a Staff user using developer tools could write a false audit entry or skip one |
| B4 | **Staff "partial edit" enforced in the flow** | Today only the screen limits which fields Staff change; the flow allows whole-record updates |
| B5 | **Stop two people overwriting each other** (warn when a record changed since you opened it) | Today the last save silently wins |
| B6 | **Load lists in parallel and page past 5,000 rows** | Each flow call takes ~1.7 s, so sign-in loads one list after another; lists over 5,000 rows would be cut off silently |
| B7 | Show **exact numbers** on dashboard cards (hover), not only $1.8K style | Readability |
| B8 | Warn when **over-shipping** a PO line or reusing a PO number | Currently accepted silently (code reads that way; not UAT-proven) |

### C. Known limits to accept or schedule
Password hash is as sensitive as a password for anyone who can read `POM_Users` · requires a premium Power Automate licence · only one shared SharePoint connection (flow runs as the service account) · AI import needs a key · audit rows can only be removed in SharePoint.

## 5. Recommendation
**Conditionally ready.** Everything that was exercised works on the real system, including role separation enforced by the server. Complete **A1–A7** (about half a day, mostly yours; A4 and A6 are mine), then run the rest of section 3 with real users for a week (pilot with 2–3 people), then schedule section B.

Re-run the automated UAT any time: `tests/uat/README.md`.
