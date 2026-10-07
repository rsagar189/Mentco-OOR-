# Automated UAT runner

Drives the real `index.html` in headless Chrome (Playwright) against the Power Automate gateway and checks
sign-in, users, master data, orders, shipments, dashboard, all four roles, server-side blocks, special
characters, refresh/sign-out, CSV export and clean-up. About 90 checks.

**Real system** (writes `UAT-` prefixed test data to your SharePoint, deletes it afterwards):
```
export POM_FLOW_URL='<flow url>'  POM_UAT_ADMIN_EMAIL='<practice admin>'  POM_UAT_ADMIN_PASSWORD='<its password>'
sed "s#^const FLOW_URL = .*#const FLOW_URL = 'https://flow.test/run';#" index.html > /tmp/app_test.html
UAT_MODE=real node tests/uat/uat.js /tmp/app_test.html
```
(The page talks to the placeholder host `flow.test`; the runner relays those calls to the real flow with curl, so the real
address is never written into a file.) Without `UAT_MODE=real` it runs against a built-in simulation of the gateway.
Needs `playwright`; set `UAT_CHROME` to a Chrome binary if the default path doesn't exist.
Never commit the flow URL or passwords.
