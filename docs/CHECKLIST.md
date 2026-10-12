# PO Manager — Simple Checklist (no IT knowledge needed)

Tick each box as you go. If anything looks different on your screen, or you see an
error, stop and send a screenshot to Claude — don't guess.

**Time needed:** about 2 hours the first time. **You need:** a shared company email
account for the app (example: `po-manager@yourcompany.com`) — ask a colleague to
create it if you can't. Use this account for Parts 1 and 2.

---

## PART 1 — Make the "filing drawers" in SharePoint (30 min)

- [ ] Go to **office.com** → sign in → click the **9 dots (top left)** → **SharePoint**.
- [ ] Click **+ Create site** → **Team site** → name it `POManager` → Next → Next → Finish.
- [ ] Do **not** add other people to this site. Skip any "add members" screen.
- [ ] Inside the site: click **+ New** → **List** → **Blank list**. Name it `POM_Orders` → Create.
- [ ] In that list click **+ Add column** → **Multiple lines of text** → Next.
      Name: `POM_Data` (exactly, capital letters, underscore, no spaces) → Save.
- [ ] Repeat the two steps above for each of these names (**9 lists in total**):

  | # | List name |
  |---|---|
  | 1 | POM_Orders |
  | 2 | POM_Shipments |
  | 3 | POM_Customers |
  | 4 | POM_Parts |
  | 5 | POM_Users |
  | 6 | POM_AuditLog |
  | 7 | POM_AppState |
  | 8 | POM_Finance |
  | 9 | POM_Sessions |

- [ ] Check: all 9 lists show under **Site contents**, each with a `POM_Data` column.
- [ ] Copy the site's web address from the browser bar and keep it
      (looks like `https://yourcompany.sharepoint.com/sites/POManager`).

---

## PART 2 — Build the "receptionist" in Power Automate (about 1 hour)

This part is mostly copy and paste. Keep `docs/SETUP.md` open next to you: every
yellow-marked box below says *"copy from SETUP.md"* and tells you which section.

- [ ] Go to **make.powerautomate.com** (same account).
- [ ] Click **+ Create** → **Instant cloud flow** → name: `PO Manager Gateway`
      → choose **"When an HTTP request is received"** → Create.
- [ ] Click the first box. Set **Who can trigger the flow** to **Anyone**.
- [ ] Click **Use sample payload to generate schema** → paste the schema from
      SETUP.md (section 2, first grey box) → Done.
- [ ] Click **+ New step** → search **Compose** → rename it `Perm`
      (click the title to rename) → paste the big box from SETUP.md "A. Compose Perm".
- [ ] **+ New step** → **Condition** → rename `Is login`. Left: the word *action* from
      the list (Dynamic content). Middle: *is equal to*. Right: `login`.
- [ ] **Yes side (login):** add the 8 items listed under "B-Yes" in SETUP.md, in order.
      For each "HTTP to SharePoint" use the action called
      **Send an HTTP request to SharePoint**; pick your site address from the list.
      Paste the web address text and the expressions exactly as written.
- [ ] **No side (everything else):** add the items under "B-No" in SETUP.md, in order.
      This includes the table of 4 cases (getItems, createItem, updateItem, deleteItem).
- [ ] Click **Save** (top right). If red error marks appear, hover over them and send Claude
      a screenshot.
- [ ] Click the first box again. A web address now shows under **HTTP POST URL**.
      Click the copy icon. **Keep it private** — paste it into a note for the next part.

Tip: expressions are pasted in the **Expression** tab (the *fx* button), not the plain
typing box.

---

## PART 3 — Connect the app and create your login (15 min)

- [ ] Open `index.html` in **Notepad** (right-click → Open with → Notepad).
- [ ] Press **Ctrl+F**, search `PASTE_YOUR_POWER_AUTOMATE_URL_HERE`. Replace it with the
      address you copied (keep the quote marks around it). Save.
- [ ] Open `index.html` in Chrome, then add `#setup` at the end of the address bar
      (example: `file:///C:/Users/you/index.html#setup`) and press Enter.
- [ ] Type your name, **any email**, a **long password** → click **Generate**.
- [ ] Go to SharePoint → list **POM_Users** → **+ New** → paste the first value into
      **Title** and the second into **POM_Data** → Save.
- [ ] Open `index.html` normally (without `#setup`) → sign in with the email and password you
      just chose. You should see the dashboard.

---

## PART 4 — Test before using real data (15 min)

- [ ] Sign in with a **wrong password** → you should see "Invalid email or password".
- [ ] In the app: **Users** → add a test user with role **Viewer 1** and a Gmail address.
- [ ] Sign out, sign in as that Viewer 1 → you should see **no prices** and no Edit/Delete buttons.
- [ ] Sign back in as yourself, add a test order, then check SharePoint:
      `POM_Orders` has the order, `POM_Finance` has the prices.
- [ ] Delete the test user and test order.

---

## PART 5 — Put it on the internet (15 min)

- [ ] Go to **pages.cloudflare.com** (or **netlify.com/drop**) → sign up free.
- [ ] Create a new project → **Upload** → drag your folder containing only `index.html`.
- [ ] You get a link (like `mentco-po.pages.dev`). Open it and sign in to check.
- [ ] Share the link with your team. Create each person's login in the app (**Users** screen).

---

## If something goes wrong
| What you see | What to do |
|---|---|
| "Sign-in failed" | In Power Automate open the flow → **Run history** → click the red run → send Claude a screenshot. |
| Blank page | Check the web address was pasted with its quote marks. |
| Can't find "HTTP request" trigger | It needs the premium feature; send Claude a screenshot. |
| Forgot admin password | Repeat Part 3 `#setup` and replace the row in `POM_Users`. |
