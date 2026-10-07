# Flow hardening: lockout after wrong passwords + instant sign-out when a user is changed or deleted

**What you get**
1. **Lockout:** 5 wrong passwords in a row lock that account for 15 minutes. A correct password does not get in while locked.
   An Admin resetting the user's password in the app unlocks it at once. A good sign-in resets the counter.
2. **Sign-out on change:** when an Admin deletes a user, changes their role or email, or resets their password, every session
   that user has open stops working immediately (instead of lasting up to 12 hours).

**How long:** about 45 minutes. Do the parts in order, saving after each. **Do this in the flow only when nobody is using the app.**
As always: formulas go in the **Expression** tab so they become a coloured chip, never typed text. Names in **bold** must match exactly.

> I tested the *design* of these steps on a simulation of your flow (14 checks passed). I can only test the real steps after
> you apply them, so tell me when you have and I will run the real test.

---
## Part A — SharePoint (5 minutes)
1. Open the list **POM_Sessions** → **+ Add column** → **Single line of text** → name it exactly `Email` → **Save**.
2. Gear icon → **List settings** → **Indexed columns** → **Create a new index** → choose `Email` → **Create**.

## Part B — Lockout (inside the login branch: `Is login` → True)

### B1. Let `Get user` return the row number
1. Click the step **Get user**. In its **Uri**, change the end `&$select=Title,POM_Data` to `&$select=Id,Title,POM_Data`.
   (Only that one word `Id,` is added. Leave the rest.)

### B2. Make `Password ok` also fail when the account is locked
1. Click the condition **Password ok**. Clear the left box (click the small x on the chip) and paste this in the **Expression** tab:
   ```
   if(greater(length(body('Get_user')?['value']),0), and(equals(json(first(body('Get_user')?['value'])?['POM_Data'])?['passHash'], triggerBody()?['passHash']), not(greater(coalesce(json(first(body('Get_user')?['value'])?['POM_Data'])?['lockUntil'],'2000-01-01T00:00:00Z'), utcNow()))), false)
   ```
   Click **Add**. Middle stays **is equal to**, right stays `true`.

### B3. What happens on a failed login (`Password ok` → red **False** box)
Right now this box holds one step, **Login failed**. We will put it inside a new condition.
1. **Delete** the step **Login failed** (⋯ → Delete). You will re-create it in step 5.
2. In the **False** box add **Condition**, rename it `Is locked`.
   - Delete the empty second row.
   - Left box, **Expression** tab:
     ```
     if(greater(length(body('Get_user')?['value']),0), greater(coalesce(json(first(body('Get_user')?['value'])?['POM_Data'])?['lockUntil'],'2000-01-01T00:00:00Z'), utcNow()), false)
     ```
   - Middle **is equal to**, right `true`.
3. In **Is locked → True**: add **Response**, rename `Login locked`.
   - **Status Code** `429`, **Headers** `Content-Type` = `application/json`
   - **Body**: `{"error":"Too many failed attempts. Try again in 15 minutes."}`
4. In **Is locked → False**: add these, in this order:
   - **Compose** → rename `NewFails` → **Inputs**, Expression tab:
     ```
     add(coalesce(json(first(body('Get_user')?['value'])?['POM_Data'])?['fails'],0),1)
     ```
   - **Compose** → rename `UserNew` → **Inputs**, Expression tab (one line):
     ```
     setProperty(setProperty(json(first(body('Get_user')?['value'])?['POM_Data']),'fails',if(greater(outputs('NewFails'),4),0,outputs('NewFails'))),'lockUntil',if(greater(outputs('NewFails'),4),addMinutes(utcNow(),15),''))
     ```
   - **Condition** → rename `User exists` → left box Expression tab: `greater(length(body('Get_user')?['value']),0)` → **is equal to** → `true`.
     In **User exists → True** add **Send an HTTP request to SharePoint**, rename `Save failed attempt`:
     - Site Address: your `PO-Manager` site · Method `POST`
     - Uri: `_api/web/lists/getbytitle('POM_Users')/items(@{first(body('Get_user')?['value'])?['Id']})`
     - Headers: `Accept` and `Content-Type` = `application/json;odata=nometadata`, plus `IF-MATCH` = `*` and `X-HTTP-Method` = `MERGE`
     - Body, Expression tab: `addProperty(json('{}'),'POM_Data',string(outputs('UserNew')))`
5. **After** the `User exists` condition (still inside **Is locked → False**) add **Response**, rename `Login failed`:
   - **Status Code** `401`, **Headers** `Content-Type` = `application/json`
   - **Body**: `{"error":"Invalid email or password"}`

### B4. Reset the counter after a good login (`Password ok` → green **True** box)
1. Scroll to the end of the True box, after the step **Login OK**. Add a **Condition**, rename `Has failures`.
   - Delete the empty second row. Left box, Expression tab:
     ```
     greater(coalesce(json(first(body('Get_user')?['value'])?['POM_Data'])?['fails'],0),0)
     ```
   - **is equal to** `true`.
2. In **Has failures → True** add **Send an HTTP request to SharePoint**, rename `Clear failed attempts`:
   - Same site, Method `POST`, same Uri and same four headers as `Save failed attempt` above.
   - Body, Expression tab:
     ```
     addProperty(json('{}'),'POM_Data',string(setProperty(setProperty(json(first(body('Get_user')?['value'])?['POM_Data']),'fails',0),'lockUntil','')))
     ```
   (This runs after the sign-in answer has already been sent, so it does not slow the sign-in.)

## Part C — Sign-out on change
### C1. Remember each session's email
1. Click the step **Create session**. Replace its **Body** (Expression tab) with:
   ```
   addProperty(addProperty(addProperty(json('{}'),'Title',outputs('Token')),'POM_Data',string(outputs('SessionData'))),'Email',toLower(string(outputs('PublicUser')?['email'])))
   ```

### C2. Allow Admin to call the new action
1. Click the **Perm** step (near the top). In its **Inputs**, add this extra entry just before the final `}`
   (add a comma after the last entry, then paste):
   ```
   ,"revokeSessions":{"POM_Sessions":"Admin"}
   ```
   Check the whole text still looks like one block of `{ ... }`.

### C3. New case in the Switch
1. Go to **Switch** (inside `Allowed` → True). Click **Add a case**, Equals `revokeSessions`.
2. Inside the case add **Send an HTTP request to SharePoint**, rename `Find sessions`:
   - Method `GET`, headers `Accept` and `Content-Type` = `application/json;odata=nometadata`
   - Uri (one line):
     ```
     _api/web/lists/getbytitle('POM_Sessions')/items?$filter=Email eq '@{replace(toLower(triggerBody()?['email']),'''','''''')}'&$top=100&$select=Id
     ```
3. Under it add **Apply to each**. In "Select an output" use the Expression tab: `body('Find_sessions')?['value']`.
   Inside it add **Send an HTTP request to SharePoint**, rename `Remove session`:
   - Method `POST`, Uri: `_api/web/lists/getbytitle('POM_Sessions')/items(@{items('Apply_to_each')?['Id']})`
   - Headers: `Accept`, `Content-Type` (as above) plus `IF-MATCH` = `*` and `X-HTTP-Method` = `DELETE`
4. After the Apply to each (not inside it) add **Response**, rename `Revoke OK`: Status `200`, header `Content-Type` = `application/json`, Body `{}`.

### Save, then switch the app on
1. **Save** the flow and wait for the green banner.
2. In `index.html` change `const HARDENED_FLOW = false;` to `true`.
3. Tell me — I will run the real test (it creates a throw-away user, makes 5 wrong attempts, checks the lock, resets it as Admin,
   changes the role and deletes the user, then removes everything).

## Known limits
- Lockout is per email address. Someone can lock an account by typing wrong passwords on purpose (it unlocks itself after 15 minutes or an Admin reset).
- Deleting a user straight in SharePoint (not in the app) does not sign them out; use the app's Users screen.
- Sessions that existed before part C1 have no email stored, so they are not signed out by this feature; they still expire after 12 hours.
