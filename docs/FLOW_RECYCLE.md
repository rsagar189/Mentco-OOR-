# Flow change: send deleted records to the SharePoint Recycle Bin (about 10 minutes)

**Why.** Tested on 8 October 2026: a customer deleted through the app did **not** appear in the SharePoint Recycle Bin.
The flow's `deleteItem` case uses the REST verb DELETE, which removes the item for good. Version history only covers edits.
This change makes deleted orders, shipments, customers, parts and users recoverable for the Recycle Bin's retention period
(normally 93 days in total). Nothing in the app changes.

## Steps
1. Power Automate → My flows → the flow → **Edit**.
2. Open the **Switch** (inside `Allowed` → Yes) → case **`deleteItem`** → the step **Delete item**
   ("Send an HTTP request to SharePoint").
3. Set its **Uri** to (one line; the two `@{…}` parts must be chips, create them with the Expression tab if they turn to text):
   ```
   _api/web/lists/getbytitle('@{triggerBody()?['listName']}')/items(@{triggerBody()?['itemId']})/recycle()
   ```
4. Keep **Method = POST**. **Remove the header `X-HTTP-Method` (DELETE).** Leave `Accept`, `Content-Type`, `IF-MATCH`.
5. **Save**.
6. Test: delete a test customer in the app; it must now be listed in SharePoint → Recycle bin. Restore it there to prove it works.
7. Export the flow again (flow → ⋯ → Export → Package) and store the .zip.

## If deletes stop working afterwards
The app shows the red "NOT saved" bar when you delete. Re-check the Uri for typos and that `X-HTTP-Method` is gone.
Undo = put the old Uri (`items(@{triggerBody()?['itemId']})`) and the `X-HTTP-Method: DELETE` header back.
