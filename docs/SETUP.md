# PO Manager — secure setup (SharePoint data + Power Automate gateway)

**How it works.** Users sign in inside the app with an email + password the **Admin**
creates (any email works — Gmail, customer, etc.; no Microsoft account needed).
The app never touches SharePoint. It talks only to **one Power Automate flow**, which
checks the login token and the user's **role on every request** and then reads or
writes SharePoint using your shared service account. Users have no direct SharePoint access.

Roles enforced by the flow (not just hidden in the screen):

| Role | Read | Create / update | Delete | Finance rates (`POM_Finance`) | Users list |
|---|---|---|---|---|---|
| Admin | all | all | all | yes | yes |
| Staff | all | orders, shipments, audit, finance | no | yes | no |
| Viewer1 | all except finance | no | no | **no** (rates never reach their browser) | no |
| Viewer2 | all | no | no | yes (read) | no |

Needs: Power Automate with the premium "When an HTTP request is received" trigger
(you confirmed this saves without a warning), and a SharePoint site you own.

## 1. SharePoint site and lists (~15 min)
1. Create a Team site (e.g. `POManager`). **Do not add the app's users to this site** —
   keep it to you + the shared service account (e.g. `po-manager@yourcompany.com`).
   They don't need access; the flow acts for them.
2. Create 9 blank lists with these exact names:
   `POM_Orders, POM_Shipments, POM_Customers, POM_Parts, POM_Users, POM_AuditLog, POM_AppState, POM_Finance, POM_Sessions`
3. In **each** list add a column: *Multiple lines of text*, plain text, named exactly `POM_Data`.

## 2. Build the flow
Sign in to make.powerautomate.com **as the service account** (so the flow doesn't stop
if you leave). Create > Instant cloud flow > skip > trigger **When an HTTP request is received**,
Who can trigger = *Anyone*. Request body schema:
```json
{"type":"object","properties":{"action":{"type":"string"},"listName":{"type":"string"},"token":{"type":"string"},
"itemId":{},"Title":{"type":"string"},"POM_Data":{"type":"string"},"email":{"type":"string"},"passHash":{"type":"string"}}}
```
Rename each step exactly as shown in **bold** (the expressions refer to those names; spaces become `_`).
Every **Send an HTTP request to SharePoint** step uses your site address and the headers
`Accept: application/json;odata=nometadata` and `Content-Type: application/json;odata=nometadata`.
Every **Response** step has header `Content-Type: application/json`.

**A. Compose `Perm`** — paste this (who may do what):
```json
{"getItems":{"POM_Orders":"Admin,Staff,Viewer1,Viewer2","POM_Shipments":"Admin,Staff,Viewer1,Viewer2","POM_Customers":"Admin,Staff,Viewer1,Viewer2","POM_Parts":"Admin,Staff,Viewer1,Viewer2","POM_AuditLog":"Admin,Staff,Viewer1,Viewer2","POM_AppState":"Admin,Staff,Viewer1,Viewer2","POM_Users":"Admin","POM_Finance":"Admin,Staff,Viewer2"},
"createItem":{"POM_Orders":"Admin,Staff","POM_Shipments":"Admin,Staff","POM_AuditLog":"Admin,Staff","POM_Finance":"Admin,Staff","POM_Customers":"Admin","POM_Parts":"Admin","POM_Users":"Admin","POM_AppState":"Admin"},
"updateItem":{"POM_Orders":"Admin,Staff","POM_Shipments":"Admin,Staff","POM_Finance":"Admin,Staff","POM_Customers":"Admin","POM_Parts":"Admin","POM_Users":"Admin","POM_AppState":"Admin"},
"deleteItem":{"POM_Orders":"Admin","POM_Shipments":"Admin","POM_Finance":"Admin","POM_Customers":"Admin","POM_Parts":"Admin","POM_Users":"Admin"}}
```

**B. Condition `Is login`**: `triggerBody()?['action']` is equal to `login`.

### B-Yes (login)
1. **Get user** — HTTP to SharePoint, GET
   `_api/web/lists/getbytitle('POM_Users')/items?$filter=Title eq '@{replace(toLower(triggerBody()?['email']),'''','''''')}'&$top=1&$select=Title,POM_Data`
2. **Condition `Password ok`** (use "edit in advanced mode"):
   `@if(greater(length(body('Get_user')?['value']),0), equals(json(first(body('Get_user')?['value'])?['POM_Data'])?['passHash'], triggerBody()?['passHash']), false)` is equal to `true`
3. **Yes:**
   - Compose **`Token`**: `guid()`
   - Compose **`PublicUser`**: `removeProperty(json(first(body('Get_user')?['value'])?['POM_Data']),'passHash')`
   - Compose **`SessionData`**: `addProperty(outputs('PublicUser'),'exp',addHours(utcNow(),12))`
   - HTTP to SharePoint, POST `_api/web/lists/getbytitle('POM_Sessions')/items`, Body (expression):
     `addProperty(addProperty(json('{}'),'Title',outputs('Token')),'POM_Data',string(outputs('SessionData')))`
   - **Response** 200, Body (expression): `addProperty(addProperty(json('{}'),'token',outputs('Token')),'user',outputs('PublicUser'))`
4. **No:** **Response** 401, Body `{"error":"Invalid email or password"}`

### B-No (everything else)
1. **Get session** — GET
   `_api/web/lists/getbytitle('POM_Sessions')/items?$filter=Title eq '@{replace(triggerBody()?['token'],'''','''''')}'&$top=1&$select=ID,Title,POM_Data`
2. **Condition `Session valid`**:
   `@if(greater(length(body('Get_session')?['value']),0), greater(ticks(json(first(body('Get_session')?['value'])?['POM_Data'])?['exp']), ticks(utcNow())), false)` is equal to `true`
3. **No:** **Response** 401, Body `{"error":"Session expired"}`
4. **Yes:**
   - Compose **`Role`**: `json(first(body('Get_session')?['value'])?['POM_Data'])?['role']`
   - **Condition `Is logout`**: action equals `logout` → **Yes:** HTTP to SharePoint POST
     `_api/web/lists/getbytitle('POM_Sessions')/items(@{first(body('Get_session')?['value'])?['ID']})` with headers `IF-MATCH: *` and `X-HTTP-Method: DELETE`, then **Response** 200 body `{}`.
   - **No:** **Condition `Allowed`**:
     `@contains(split(coalesce(outputs('Perm')?[triggerBody()?['action']]?[triggerBody()?['listName']],''),','),outputs('Role'))` is equal to `true`
     - **No:** **Response** 403, Body `{"error":"Not allowed for your role"}`
     - **Yes:** **Switch** on `triggerBody()?['action']`:

| Case | Method | Uri (after `_api/web/lists/getbytitle('@{triggerBody()?['listName']}')/`) | Extra headers | Body (expression) |
|---|---|---|---|---|
| `getItems` | GET | `items?$top=5000` | | |
| `createItem` | POST | `items` | | `addProperty(addProperty(json('{}'),'Title',triggerBody()?['Title']),'POM_Data',triggerBody()?['POM_Data'])` |
| `updateItem` | POST | `items(@{triggerBody()?['itemId']})` | `IF-MATCH: *`, `X-HTTP-Method: MERGE` | same as create |
| `deleteItem` | POST | `items(@{triggerBody()?['itemId']})` | `IF-MATCH: *`, `X-HTTP-Method: DELETE` | |

Each case ends with **Response** 200 whose Body = *Body* of that case's HTTP step
(for `updateItem`/`deleteItem` use body `{}`).

Save, then open the trigger and copy the **HTTP POST URL**.

## 3. Paste the URL and create the first Admin
1. In `index.html` replace `PASTE_YOUR_POWER_AUTOMATE_URL_HERE` (near line 477) with the URL.
2. Open `index.html#setup` (the page address + `#setup`). Enter your name, email (any) and
   password > *Generate*. In SharePoint list **POM_Users** add one item: paste the **Title**
   and **POM_Data** values it shows.
3. Open the app normally and sign in. From then on, create/edit/delete users in the app
   (Users screen) — no SharePoint editing needed.

## 4. Host the page
SharePoint cannot display `.html` pages (it forces a download), so host `index.html` elsewhere.
The page holds no secrets any more — the flow rejects anything without a valid login — so a
public host is fine:
- **Cloudflare Pages** / **Netlify** (free, drag-and-drop, no card), or
- **Azure Static Web Apps** (free tier; stays in Microsoft but needs an Azure subscription).

## Test checklist (do this before real data)
- Wrong password → "Invalid email or password".
- Admin signs in; add a Viewer1 user; sign in as Viewer1 → no rates visible, no Edit/Delete.
- In the flow's *Run history* you should see 401 on bad tokens and 403 on forbidden actions.
- Add a test order as Staff; check POM_Orders has **no** rate values and POM_Finance does.

## Known limits (be aware)
1. The browser app was tested against a simulation of this flow (login, roles, finance split,
   expiry — all passed). **The Power Automate flow itself I could not run**, so expect to fix a
   typo or two while building it; the Run history shows exactly which step failed.
2. Password hashes sit in `POM_Users` and are visible to anyone with access to the SharePoint
   site and to Admins in the app. Keep the site private (step 1).
3. Anyone who knows an email can *attempt* logins; the flow has no lockout. Use long passwords.
4. A deleted user's already-open session lasts up to 12 hours. Sessions are not auto-cleaned;
   delete old rows from `POM_Sessions` occasionally.
5. Staff "partial edit" limits (some fields read-only) are enforced in the screen only; the flow
   allows Staff to update whole orders/shipments.
6. Two people editing the same record: last save wins.
7. **AI PO import** still calls the Anthropic API with no API key and will not work outside
   Claude. It needs a key kept inside the flow; ask if you want it wired up.
