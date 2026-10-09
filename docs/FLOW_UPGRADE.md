# Flow upgrade — turn on paging, search columns and safe edits

The updated `index.html` (v1.1) works with your **current flow** as it is. These steps unlock the features that
matter once you have thousands of orders. Do them in order; each step has a switch in `index.html`
(next to `const FLOW_URL`) that you turn on **only after** that step is done and tested.

| Step | What you do | Switch to turn on afterwards |
|---|---|---|
| 1 | Let the flow accept a "query" (about 5 minutes) | `FLOW_QUERY = true` |
| 2 | Add search columns in SharePoint, then let the flow save them (about 40 minutes) | `USE_COLUMNS = true` |
| 3 | Optional hardening in the flow (lockout, session clean-up, failure email) | none |

**Why:** today the flow reads at most 5,000 rows per list and cuts the rest off without telling anyone. With step 1
the app reads every page. With step 2 it loads only open orders plus the last 24 months at sign-in, and
older history on request. The app shows a yellow warning if it ever detects the 5,000 cut-off.

> Do these steps **in the live flow only when nobody is using the app**, or copy the flow first
> (flow page → **Save As**) and test on the copy with a copy of `index.html`.
> As always: formulas go in the **Expression** tab so they become a coloured chip, never typed text.

---
## Step 1 — the flow accepts a "query" (paging and newest-first reads)
1. Power Automate → your flow → **Edit**.
2. Open the `Read items` step (inside the Switch, case `getItems`).
3. Replace its **Uri** with this (one line; the part in `@{…}` becomes a pink chip):
   ```
   _api/web/lists/getbytitle('@{triggerBody()?['listName']}')/items?@{coalesce(triggerBody()?['query'],'$top=5000')}
   ```
4. **Save.** Nothing else changes. If the app sends no query (old behaviour) the flow still reads up to 5,000 rows.
5. Edit `index.html`: change `const FLOW_QUERY  = false;` to `true`. Open the app and sign in.
   Check: sign-in works, and the audit log (Users screen) shows the newest entries with a "Load older entries" button.

## Step 2 — search columns (do the SharePoint part first)
### 2a. SharePoint (you)
On the `PO-Manager` site, add these columns. **Names must be exact (no spaces).** Use **Add column** in each list.

| List | Column name | Type |
|---|---|---|
| POM_Orders | `Customer` | Single line of text |
| POM_Orders | `OrderDate` | Date and time → **Date only** |
| POM_Orders | `Status` | Single line of text |
| POM_Shipments | `ShipDate` | Date and time → **Date only** |
| POM_Shipments | `Status` | Single line of text |
| POM_Finance | `OrderDate` | Date and time → **Date only** |

Then **index** the ones used for searching (otherwise SharePoint refuses to search a list over 5,000 rows):
list → ⚙ **Settings** → **List settings** → **Indexed columns** → **Create a new index** for:
`POM_Orders`: `Status`, `OrderDate` · `POM_Shipments`: `ShipDate` · `POM_Finance`: `OrderDate`.
Also create an index on **Title** for `POM_Users` and `POM_Sessions`.

### 2b. Flow (you)
1. In the flow, open the **`Create item`** step (Switch case `createItem`). Replace its **Body** (Expression tab) with:
   ```
   union(addProperty(addProperty(json('{}'),'Title',triggerBody()?['Title']),'POM_Data',triggerBody()?['POM_Data']),json(coalesce(triggerBody()?['Cols'],'{}')))
   ```
2. Do the same for the **`Update item`** step's **Body** (same expression).
3. **Save.** If the app sends no `Cols` the flow behaves exactly as before.
4. Edit `index.html`: change `const USE_COLUMNS = false;` to `true`.
5. Sign in as Admin → **Master Data → Dropdown lists → Maintenance → Rebuild search columns**. This re-saves the loaded
   orders, shipments and rates so the new columns are filled. (Do this once. If you already have older data,
   first press **Load older history** on the Orders page for the full range, then rebuild.)
6. Check in SharePoint: new orders show `Customer`, `OrderDate`, `Status` filled in; a shipment shows `ShipDate`, `Status`.

> If a save fails with an error about a column, one of the names above is misspelt or a column is missing. The red
> "NOT saved" bar in the app will say so; fix the column name and press **Retry**.

## Step 3 — hardening in the flow (optional but recommended)
Each item is independent. All of these use Power Automate screens only; none touches the app.
1. **Failure email:** flow page → **Edit** → ⚙ (top right) → turn on / add an email for failed runs, or build a second
   tiny flow "when a flow run fails → send email to me". Pick the shared mailbox.
2. **Clean up old sessions daily:** new **Scheduled cloud flow** (every day) → **Send an HTTP request to SharePoint**
   GET `_api/web/lists/getbytitle('POM_Sessions')/items?$top=500&$select=Id,POM_Data` → **Apply to each** over `value` →
   condition `json(items('Apply_to_each')?['POM_Data'])?['exp']` is less than `utcNow()` → yes: **Send an HTTP request to
   SharePoint** POST `_api/web/lists/getbytitle('POM_Sessions')/items(@{items('Apply_to_each')?['Id']})` with headers
   `IF-MATCH: *` and `X-HTTP-Method: DELETE`.
3. **Weekly backup:** new **Scheduled cloud flow** (weekly) → **Get items** (SharePoint connector, one per list, set *Top
   Count* 5000 and enable *pagination* in ⋯ → Settings) → **Create CSV table** → **Create file** in a SharePoint document
   library (name with `formatDateTime(utcNow(),'yyyy-MM-dd')`). Keep at least 8 weeks.
4. **Lockout after wrong passwords** and **instant sign-out when a user is deleted or changed**: see **docs/FLOW_HARDENING.md**
   (exact steps; the design is tested on a simulation, and the real test runs once you have applied them).

---
## What the switches do in the app
| Switch | Off | On |
|---|---|---|
| `FLOW_QUERY` | reads each list once (max 5,000 rows, with a yellow warning if it hits that); audit log trimmed in the browser | reads every page; newest-first audit log; checks for edit clashes between two people |
| `USE_COLUMNS` | loads everything | loads open orders + last 24 months at sign-in; "Load older history" on Orders/Shipments; keeps the Status columns in step with shipments |
| `AI_IMPORT` | document import buttons hidden | shown (needs an API key kept inside the flow — not built yet) |
