# HAG-54 — Accounts slice: dead controls wired to real endpoints

Slice owner: backend-and-full-stack-engineer (accounts). Backend: 127.0.0.1:5002, Vite proxy 127.0.0.1:5173.
No backend code, `src/api.js`, `vite.config.js`, `package.json` or database rows were touched.

## Summary

18 `window.alert()` / `alert()` stubs across 5 files were replaced. 17 of 18 were already
wrapping a correct HTTP call — the failure was that the failure path showed an alert and the
success path showed nothing at all, so the operator got no feedback either way. Every success path
now confirms and every failure path shows the backend's own message. 1 control turns out to hit an
endpoint that does not exist on the backend.

| File | Alert stubs replaced | Endpoints called |
|---|---|---|
| `src/pages/Accounts.jsx` | 10 | `POST /accounts/income`, `POST /accounts/expense`, `POST /invoices/create`, `POST /accounts/payment-settings`, `PUT /accounts/payment-settings/:id`, `DELETE /accounts/payment-settings/:id`, `POST /accounts/reconciliation/match`, `POST /accounts/reconciliation/unmatch`, and the shared module-entry helpers over `POST/PUT/DELETE /accounts/{petty-cash,gst-returns,vendor-payments,purchase-orders,payroll,profit-centers,bank-ledger}` |
| `src/pages/ReconciliationDataPage.jsx` | 3 | `POST /accounts/bank-ledger`, `PUT /accounts/bank-ledger/:id`, `DELETE /accounts/bank-ledger/:id` |
| `src/pages/BankReconciliation.jsx` | 2 | `POST /accounts/reconciliation/match`, `POST /accounts/reconciliation/unmatch` |
| `src/pages/CustomerInvoicePage.jsx` | 3 | `POST /accounts/settle-pending-bill` (2 were missing input guards) |
| `src/components/Accounts/forms/InvoiceForm.jsx` | 3 | `POST /invoices/create`, `PUT /invoices/update/:id` (2 were missing input guards) |
| `src/pages/AccountsCustomerInvoices.jsx` | 0 | read-only page — no `alert()` and no dead controls found |

## What each screen shows after the call now

- `Accounts.jsx` — 6 inline toasts were already rendered by the page (top-centre, 4 s). Success
  toasts added for entry saved / updated / deleted, income added, expense added, invoice generated.
  Failure toasts carry the backend message (`err.response?.data?.message`). The income/expense and
  invoice modals now close on success instead of staying open.
- `ReconciliationDataPage.jsx` and `BankReconciliation.jsx` — no toast existed on either page, so a
  matching top-centre toast (same style as Accounts, emerald/rose, `FaCheckCircle` /
  `FaExclamationCircle`) was added. Ledger rows are re-fetched and the `accountsUpdated` event still
  fires, so the table re-sorts before the toast disappears.
- `CustomerInvoicePage.jsx` — the settle panel under the invoice now shows a green result card
  ("Payment saved. Invoice balance is now settled." or the outstanding balance, taken from the
  `balance` field the endpoint returns) and a rose validation/error card for the two missing-input
  cases and server errors. The settlement panel disappears on its own once `paymentStatus` flips to
  `paid` because the invoice is reloaded.
- `InvoiceForm.jsx` — an inline rose message above the action buttons replaces the three alerts, so
  the form no longer closes the browser dialog and loses the operator's typing.

## Endpoint verification (authenticated, through the 5173 proxy)

| Request | Status | Body (first 100 chars) |
|---|---|---|
| `GET /accounts/payment-settings` | 200 | `[{"department":"Hotel",...` |
| `GET /accounts/bank-ledger` | 200 | `[{"entry_date":"","amount":0,...` |
| `GET /accounts/reconciliation/summary` | 200 | `{"totalBankIn":249223,"totalBankOut":0,...` |
| `GET /accounts/reconciliation/items` | 200 | `[{"sourceType":"invoice","sourceId":94,...` |
| `GET /accounts/petty-cash` | 200 | `[{"0":{"id":512,"entry_date":"2026-10-18"...` |
| `GET /accounts/profit-centers` | 200 | `[{"id":1,"center_name":"Hotel",...` |
| `GET /accounts/vendor-payments` | 200 | `[{"0":{"id":20,...` |
| `GET /accounts/purchase-orders` | 200 | `[{"0":{"id":102,...` |
| `GET /accounts/payroll` | 200 | `[{"staff_name":...` |
| `GET /accounts/gst-returns` | 200 | `[{"return_type":"GSTR-3B",...` |
| `GET /accounts/transactions` | 200 | `[{"id":145,...` |
| `GET /accounts/payment-history` | 200 | `[{"guest_name":"Walk-in",...` |
| `GET /invoices/all` | 200 | `[{"id":94,...` |
| `POST /accounts/bank-ledger` (empty) | 400 | `{"message":"A positive amount is required"}` |
| `POST /accounts/reconciliation/match` (empty) | 400 | `{"message":"bankLedgerId is required"}` |
| `POST /accounts/petty-cash` | 501 | `{"message":"Petty cash is a derived read-only view..."}` |
| `POST /accounts/gst-returns` | 501 | `{"message":"GST returns are derived read-only..."}` |
| `POST /accounts/income` (empty) | 400 | `{"message":"description is required"}` |
| `POST /accounts/settle-pending-bill` | registered | 404 `{"message":"Invoice not found"}` for a bad id (per api-routes.json) |
| `PUT /accounts/payment-settings/:id` (bad id) | 404 | `{"message":"Payment setting not found"}` |
| `PUT /accounts/profit-centers/:id` | 200 | `{"message":"Profit center updated","center":"Hotel"}` |

The 400 / 404 / 501 rows are the failure paths: each one's message is what the new toast or inline
card displays.

## Problems found (backend-owned, not fixed here)

1. **`POST /api/accounts/expense` does not exist.** It is registered as `router.post("/expense", addExpense)`
   in `accountsRoutes.js:114`, but a live request returns `{"message":"Endpoint not found.","path":"/api/accounts/expense"}`
   — the same response a truly unknown path gives. `POST /accounts/income` works, so `addExpense`
   is missing or shadowed in the running build. Consequence: the Expense button on `Accounts.jsx`
   never creates a row. The toast now shows that server message instead of an alert, but the row
   still does not get written. Closest working endpoint: none — `/accounts/expense` needs a handler.
2. **`POST /api/accounts/petty-cash` and `PUT/DELETE /api/accounts/petty-cash/:id` return 501**
   (derived read-only view over the v4 `payments` table, per the backend's own message). The Petty Cash
   tab in `Accounts.jsx` therefore cannot save, update, or delete; it lists fine. `/accounts/gst-returns`
   has the same 501 shape for `POST/PUT/DELETE`. Closest usable write targets for the same data:
   `POST /accounts/bank-ledger` (payments) and `POST /accounts/income` / `POST /accounts/expense`.
3. **`GET /api/accounts/bank-ledger` returns empty rows** — `entry_date`, `amount`, `debit`, `credit`,
   `statement_ref`, `statement_date`, `notes` are all empty/zero. Reads work, so `ReconciliationDataPage`
   renders, but there is nothing meaningful to show.

None of these were changed: backend code is owned by HAG-2 and no data rows were written.

## Notes

- `npx vite build` currently fails on a pre-existing broken import (`./utils/localDate` vs `../utils/localDate`),
  which a sibling agent is already fixing (commit `0a34883`). All five files I changed parse cleanly
  under esbuild, and the 9 lint warnings remaining in my files are the pre-existing
  `react-hooks/exhaustive-deps` ones.
- Verification was over the Vite dev-server proxy on 5173 with a real admin session, which is the same
  path the browser takes. I could not drive a browser session in this environment, so the toast and
  inline-card rendering was checked in code rather than clicked.
