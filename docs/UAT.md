# PO Manager — User Acceptance Test (UAT)

**Who runs it:** you (Admin) plus one person for each role.  **How long:** about 2 hours.
**Rule:** do the tests in order. For each one write **Pass**, **Fail** or **N/A** and a note.
If something fails, take a screenshot and write the test ID (e.g. `ORD-3`). Send me the list of fails.

## 0. Before you start
- [ ] Latest `index.html` (flow address on the `const FLOW_URL` line), opened in Chrome.
- [ ] Four test logins created in the Users screen (any email, any password):
  | Name | Role | Used for |
  |---|---|---|
  | UAT Admin (you already have one) | Admin | everything |
  | UAT Staff | Staff | create/edit, no delete |
  | UAT Viewer1 | Viewer 1 | read-only, **no prices** |
  | UAT Viewer2 | Viewer 2 | read-only, **sees prices** |
- [ ] Test data to enter (all names start with `UAT-` so they are easy to delete later):
  customer `UAT-Customer`, part `UAT-P100` (desc "test part"), PO number `UAT-PO-001`.
- [ ] SharePoint site open in another tab, to check rows.

---
## 1. Sign-in and sessions
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| AUTH-1 | Sign in with a wrong password | "Invalid email or password"; not signed in | |
| AUTH-2 | Sign in with an email that doesn't exist | Same message | |
| AUTH-3 | Sign in as UAT Admin | Dashboard opens; badge shows "Administrator"; green SharePoint badge | |
| AUTH-4 | Press F5 (refresh) | Still signed in; data reloads | |
| AUTH-5 | Sign out, then press F5 | Login screen | |
| AUTH-6 | Close the tab, open the file again | Login screen (must sign in again) | |
| AUTH-7 | Sign in as a user whose email is **not** a company email (e.g. Gmail) | Works | |
| AUTH-8 | Sign in as the same user in two browsers | Both work independently | |
| AUTH-9 | Delete a `POM_Sessions` row in SharePoint, then click any menu item | Sent back to login with "session expired" | |

## 2. User management (Admin)
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| USR-1 | Users → add UAT Staff (Staff) | Appears in list; row in `POM_Users` | |
| USR-2 | Add Viewer1 and Viewer2 users | Both appear | |
| USR-3 | Add a user with an email that already exists | Blocked with a message | |
| USR-4 | Add a user with no password | Blocked | |
| USR-5 | Edit a user's role (Staff → Viewer1), save, sign out/in as them | Role change applies | |
| USR-6 | Edit a user's password; sign in with the new one; try the old one | New works, old fails | |
| USR-7 | Edit a user's email without a new password | Asks for a new password | |
| USR-8 | Delete a user | Row gone from list and from `POM_Users` | |
| USR-9 | Try to delete yourself | Not allowed ("Can't delete self") | |
| USR-10 | Sign out/in | Users list is the same (saved, not lost) | |

## 3. Master data (Admin)
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| MST-1 | Master Data → add customer `UAT-Customer` | Appears; row in `POM_Customers` | |
| MST-2 | Add a duplicate customer name | Blocked ("Already exists") | |
| MST-3 | Add part `UAT-P100` for that customer | Appears; row in `POM_Parts` | |
| MST-4 | Add the same part for the same customer again | Blocked | |
| MST-5 | Edit the customer's contact/email, save, refresh | Change kept; **no duplicate row** in SharePoint | |
| MST-6 | Edit the part description | Change kept | |
| MST-7 | Delete a customer that has parts | Warns it deletes the parts too; both removed | |

## 4. Purchase orders
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| ORD-1 | Orders → **+ New Order**. Step 1: customer `UAT-Customer`, PO `UAT-PO-001`, today's date | Can go to step 2 | |
| ORD-2 | Step 2: add line: part `UAT-P100`, qty 100, original dock date next month, in-transit days 20, India rate 5, US rate 8 | Line added; extended sales show (100×5, 100×8) | |
| ORD-3 | Add a second line (qty 50) | Two lines | |
| ORD-4 | Step 3 Review → Save → Confirm | Order saved; appears in list as **Open** | |
| ORD-5 | Check SharePoint `POM_Orders` | One row; the data has **no** rate values | |
| ORD-6 | Check SharePoint `POM_Finance` | One row with the rates | |
| ORD-7 | Refresh the app | Order and its rates still there | |
| ORD-8 | Create another order with the same PO number | Behaviour is sensible (warn or allowed — note what happens) | |
| ORD-9 | Open the order → Edit (as Admin), change a quantity, save | Saved; list updates; same row in SharePoint (no duplicate) | |
| ORD-10 | **Short close** a line (enter a short-close qty) | Status "Short Closed"; effective qty reduces; audit entry | |
| ORD-11 | **Cancel** a line | Shows Cancelled; quantity treated as 0 | |
| ORD-12 | Reopen the cancelled line (Admin) | Back to Open | |
| ORD-13 | **Cancel PO** (Admin) on a test order | Whole order Cancelled | |
| ORD-14 | Delete a test order (Admin) | Gone from app, `POM_Orders` and `POM_Finance` | |
| ORD-15 | Search / filter the order list (customer, status, part, dates) | Results match; Reset clears filters | |
| ORD-16 | Export orders to CSV (all three types) | File downloads; opens in Excel; numbers correct | |

## 5. Shipments
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| SHP-1 | Shipments → **+ New Shipment**: invoice `UAT-INV-001`, ship date, location | Header accepted | |
| SHP-2 | Add a line linked to `UAT-PO-001` / `UAT-P100`, shipped qty 40, status **In Transit** | Line added | |
| SHP-3 | Save | Appears in shipments; row in `POM_Shipments` | |
| SHP-4 | Open the order | "In Transit" quantity is 40; open qty reduces correctly | |
| SHP-5 | Edit the shipment, set status **Delivered**, add delivery date, save | Order shows Delivered 40; open qty falls | |
| SHP-6 | Ship more than the open qty | Behaviour is sensible (warn or cap — note what happens) | |
| SHP-7 | Re-link a shipment line to a different PO (Admin) | Totals move to the other PO | |
| SHP-8 | Delete a shipment (Admin) | Order's delivered/in-transit numbers go back | |
| SHP-9 | Filter and export shipments | Matches; CSV downloads | |

## 6. Dashboard
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| DSH-1 | Open Dashboard with the test data | PO values, in-transit, delivered match what you entered (calculate by hand once) | |
| DSH-2 | Apply customer / part / date filters | Numbers change accordingly | |
| DSH-3 | Overdue and on-time-delivery cards | Make sense for the dates you entered | |
| DSH-4 | Monthly charts | Show the right months | |

## 7. Roles (the most important section)
Sign in as each role and fill in the table. "Yes" = can do it, "No" = must be blocked.

| ID | Action | Admin | Staff | Viewer1 | Viewer2 | Actual (write Y/N per role) |
|---|---|---|---|---|---|---|
| ROL-1 | See orders & shipments | Yes | Yes | Yes | Yes | |
| ROL-2 | See India/US rates & extended sales | Yes | Yes | **No** ("No Access") | Yes | |
| ROL-3 | See finance KPIs and charts on dashboard | Yes | Yes | **No** | Yes | |
| ROL-4 | Create order / shipment | Yes | Yes | **No** (no button) | **No** | |
| ROL-5 | Edit order | Yes | Update fields only | No | No | |
| ROL-6 | Delete order / shipment | Yes | **No** | No | No | |
| ROL-7 | Master Data and Users menus | Yes | **No** | No | No | |
| ROL-8 | Re-link / Cancel PO | Yes | No | No | No | |
| ROL-9 | Export CSV with finance columns | Yes | Yes | **No** | Yes | |
| ROL-10 | Audit log | Yes | — | — | — | |

**Server-side check (proves rules are not just hidden buttons):**
| ID | Steps | Expected | Result |
|---|---|---|---|
| SEC-1 | As Viewer1, open Chrome Developer Tools (F12) → Console, run: `flowCall('deleteItem','POM_Orders',{itemId:1})` | Error "Not allowed for your role"; order still there | |
| SEC-2 | As Viewer1, run: `flowCall('getItems','POM_Finance')` | Error "Not allowed for your role" | |
| SEC-3 | Not signed in, run: `flowCall('getItems','POM_Orders')` | Rejected (session/401) | |

## 8. Audit log and history
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| AUD-1 | Create, edit, short close, cancel an order | Each has an audit entry with who, when, old → new values | |
| AUD-2 | Export audit log CSV | Downloads; matches screen | |
| AUD-3 | Check `POM_AuditLog` in SharePoint | Entries are there | |

## 9. Data safety and behaviour
| ID | Steps | Expected | Result / notes |
|---|---|---|---|
| DAT-1 | Add data, close the browser, open on **another computer**, sign in | Same data | |
| DAT-2 | Two people edit **different** orders at the same time | Both saved | |
| DAT-3 | Two people edit the **same** order | Last save wins (known limit) — note what you see | |
| DAT-4 | Turn off your internet, try to save | An error appears (not silent success); nothing half-saved | |
| DAT-5 | Enter a very long text (e.g. 2000 characters) in a notes field and save | Saved and reloads correctly | |
| DAT-6 | Enter 100+ test orders (or ask me for a loader) and open the app | Loads in a reasonable time (< 10 s); note the time | |
| DAT-7 | Special characters in names and notes: `O'Brien`, `"quotes"`, `&`, `<b>`, Hindi/other scripts | Saved and displayed exactly, no broken page | |

## 10. Known limits (do not mark as Fail — just confirm they are acceptable)
- **AI purchase-order import** does not work yet (needs a key kept inside the flow).
- No password lockout after wrong guesses.
- Deleting a user does not end their already-open session (up to 12 hours).
- Staff "partial edit" limits are enforced on screen only.
- Last save wins if two people edit the same record.

---
## Defect log
| # | Test ID | What happened | Expected | Screenshot? | Severity (High/Med/Low) |
|---|---|---|---|---|---|
| 1 | | | | | |

## Sign-off
- All **High** defects fixed and retested: ☐
- Roles section (7) fully passed: ☐
- Flow address replaced with a fresh one before go-live: ☐
- Test data (`UAT-…`) and test users deleted: ☐
- Approved by: ______________  Date: ____________
