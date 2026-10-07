# PO Manager – hosting + SharePoint storage (no IT help)

The app (`index.html`) already talks to SharePoint through a Power Automate
flow. It sends `POST {action, listName, ...}` to `FLOW_URL`. You need to:
1. create 7 SharePoint lists, 2. build one flow, 3. paste its URL, 4. host the file.

## 0. Check these first (they decide what's possible)
- **Premium license:** the flow trigger "When an HTTP request is received" is a
  *premium* Power Automate feature. When you add it, a diamond icon appears. If
  you see "needs premium license" and have no Power Automate Premium / Per-user
  plan, step 2 won't run and you'd need a license (or IT) for that one item.
- **You must own the SharePoint site** (`https://mentco365.sharepoint.com/sites/POManager`)
  so you can create lists. If it doesn't exist: SharePoint > Create site > Team site.

## 1. Create the lists (once, ~10 min)
On the site: New > List > Blank list. Create these 7 names exactly:
`POM_Orders, POM_Shipments, POM_Customers, POM_Parts, POM_Users, POM_AuditLog, POM_AppState`

In EACH list: Add column > **Multiple lines of text**, name it exactly `POM_Data`
(no spaces), plain text. The built-in `Title` column is used too.

## 2. Build the flow (Power Automate > Create > Instant cloud flow > skip)
**Trigger:** When an HTTP request is received. Who can trigger: *Anyone*.
Request body JSON schema:
```json
{"type":"object","properties":{"action":{"type":"string"},"listName":{"type":"string"},
"itemId":{},"Title":{"type":"string"},"POM_Data":{"type":"string"}}}
```
**Then add a Switch** on `triggerBody()?['action']` with these cases. Every case
uses the SharePoint action **Send an HTTP request to SharePoint** (standard
connector), Site Address = your site, and ends with a **Response** action
(Status 200, Body = *Body* of the previous step). Headers on all requests:
`Accept: application/json;odata=nometadata` and
`Content-Type: application/json;odata=nometadata`.

| Case | Method | Uri | Extra headers | Body |
|---|---|---|---|---|
| `getItems` | GET | `_api/web/lists/getbytitle('@{triggerBody()?['listName']}')/items?$top=5000` | | |
| `createItem` | POST | `_api/web/lists/getbytitle('@{triggerBody()?['listName']}')/items` | | `{"Title":"@{triggerBody()?['Title']}","POM_Data":"@{triggerBody()?['POM_Data']}"}` — see note below |
| `updateItem` | POST | `_api/web/lists/getbytitle('@{triggerBody()?['listName']}')/items(@{triggerBody()?['itemId']})` | `IF-MATCH: *`, `X-HTTP-Method: MERGE` | same as create |
| `deleteItem` | POST | same item Uri as update | `IF-MATCH: *`, `X-HTTP-Method: DELETE` | |
| `ensureLists` | – | – | – | Just a Response with body `{}` (lists were created by hand in step 1) |

**Note on the body:** `POM_Data` is JSON-in-a-string, so build the body with an
expression instead of typing it, otherwise quotes break it. In the Body box use:
`@{json(concat('{"Title":', string(triggerBody()?['Title']), ',"POM_Data":', string(triggerBody()?['POM_Data']), '}'))}`

Save the flow. Open the trigger and copy **HTTP POST URL**.

## 3. Paste the URL
In `index.html` line ~489 replace `PASTE_YOUR_POWER_AUTOMATE_URL_HERE` with that URL.
The header badge turns green ("SharePoint") when it works.

## 4. Hosting
SharePoint/OneDrive will **not** display an `.html` file as a web page (it forces a
download), so the app itself must live elsewhere. Zero-IT options:
- **GitHub Pages / Netlify / Cloudflare Pages** – free, drag-and-drop, gives a URL.
- Or each user just opens a copy of `index.html` from a shared folder (works, but
  updates need re-sharing).

## Things to know before going live
1. **The flow URL is a password.** Anyone who can view the page source can read and
   write all your data. Keep the hosted URL private/unlisted, and rotate the flow
   (re-save trigger to get a new URL) if it leaks.
2. **Logins are not secure.** User emails and passwords (`admin123` etc.) are plain
   text in the JS and in `POM_Users`. Change the defaults and treat login as a
   convenience, not security.
3. **AI PO import won't work when self-hosted.** It calls the Anthropic API from the
   browser with no API key (works only inside Claude). It needs a key via a small
   proxy (e.g. another flow) – ask and I can wire that up.
4. Two people editing at once = last save wins (no locking).
