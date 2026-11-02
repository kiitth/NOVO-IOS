# Novo Dialysis Supply Hub

Product specification and development guide for a shared ordering and inventory web application serving multiple Novo Dialysis locations.

**Specification status:** working draft based on the operational workflow discussed so far and the supplied `Master sheet oct21.xlsx` workbook. Requirements describe the intended product; they do not imply that a feature is implemented. Proposed defaults and unresolved decisions are identified below.

## 1. Purpose

Give Novo staff one place to see what each location has, what it needs, what has been ordered, and what is moving between locations. Use historical treatment activity and recorded supply usage to support weekly purchasing decisions.

The hub should reduce manual spreadsheet work, prevent duplicate orders, make shortages visible, and preserve a reliable history of inventory movement and purchasing.

### Confirmed scope

- A responsive web application for computers, tablets, and phones.
- Multiple locations with separate inventory and a central overview.
- Initial locations: Jamaica and Flatland, as named in the workbook. Display names remain editable.
- Inventory counts, low-stock alerts, supply orders, and inter-location transfer logs.
- Medications, dialysis supplies, clinical consumables, office supplies, bathroom supplies, and breakroom supplies.
- Date-filtered treatment reports, with weekly review as the usual planning period.
- Medication purchasing through Cardinal Vantus and Proficient Rx.
- Phone ordering through Fresenius and Henry Schein.
- Amazon purchasing for office, bathroom, and breakroom replenishment.

### Product boundaries

The hub supports inventory and procurement decisions. It does not prescribe medication, change patient treatment, or replace the clinical system where nurses and technicians record care. Supply suggestions require staff review before ordering. Website purchasing and phone calls initially happen outside the hub, with their results recorded inside it.

## 2. Users and access

The following roles are proposed defaults, pending confirmation of Novo's approval process.

| Role | Intended responsibilities |
| --- | --- |
| Organization administrator | Manage locations, users, access, catalogs, supplier details, and settings. |
| Central purchasing / operations | Review stock across locations, prepare and place orders, coordinate transfers, and review usage. |
| Location manager | Manage counts, location targets, requests, deliveries, and transfers for assigned locations. |
| Location staff | Enter counts, request supplies, and confirm authorized deliveries or transfers. |
| Read-only viewer | View permitted inventory and activity without changing records. |

Access must be enforced by the server, including location restrictions. Approval permissions should be separate from permission to submit requests. Production access requires authenticated users and shared persistent storage; neither exists in the current sketch.

## 3. Locations and inventory ownership

- Maintain a shared item catalog with separate balances and replenishment settings for each location.
- Show a location selector throughout the application, including an all-locations overview.
- Every stock movement and order delivery must identify a location.
- All-locations totals must aggregate compatible units and retain access to the underlying location balances.
- Support additional locations without duplicating the catalog or changing application code.
- Storage areas within a location, such as medication room or supply room, are a proposed extension.

## 4. Suppliers and purchasing routes

| Supplier | Confirmed ordering route | Intended hub support |
| --- | --- | --- |
| Fresenius | Phone | Supplier-specific call sheet, item numbers, pack sizes, quantities, confirmation, and delivery tracking. |
| Henry Schein | Phone | Supplier-specific call sheet, item numbers, pack sizes, quantities, confirmation, and delivery tracking. |
| Cardinal Vantus | Website | Medication order preparation, saved portal link, and manual order confirmation. |
| Proficient Rx | Website | Medication order preparation, saved portal link, and manual order confirmation. |
| Amazon | Website | Product links, purchasing lists, costs, and delivery tracking for workplace supplies. |

Supplier assignment is per item, not inferred solely from category. An item may have multiple supplier offerings with different item numbers, package sizes, prices, and lead times. Supplier contact details and location-specific account references belong in restricted settings, not source code.

Portal URLs, ordering cutoffs, account details, shipping schedules, minimum orders, and exact medication-to-supplier assignments still need confirmation. No external purchase is submitted automatically in the initial release.

## 5. Item catalog and units

### Required item information

- Internal item ID and display name.
- Category and active / inactive status.
- Supplier offerings and supplier item numbers stored as text to preserve leading zeros and punctuation.
- Base inventory unit, counting units, and purchasing pack sizes.
- Explicit conversions, such as units per box and boxes per case.
- Optional product URL, description, and unit cost with effective date.
- Lot and expiration tracking where relevant; exact item requirements need confirmation.

### Initial categories

Medications; dialyzers; saline; bibags and bicarbonate; concentrates; treatment supplies; clinical essentials; office supplies; bathroom supplies; breakroom supplies. Categories remain configurable.

### Unit rules

1. Store stock movements in one defined base unit per item and retain the entered quantity and unit for traceability.
2. Convert cases, boxes, bags, and individual units only using verified item-specific conversion factors.
3. Never assume one box, bag, or case contains the same amount across items or suppliers.
4. Preserve missing values as unknown. An uncounted item is different from an item counted at zero.
5. Round purchase suggestions up to whole permitted supplier packs and apply minimum quantities only when configured.
6. Medication conversion requires verified product strength, concentration, presentation, and package size. Do not combine incompatible strengths or infer dose equivalents from a product name.

## 6. Inventory workflow

### Counts and adjustments

Staff select a location, find an item, and enter a count with its unit and count date. The hub shows the previous balance, difference, and a required adjustment reason when the count changes stock.

Inventory changes must create ledger entries rather than silently replacing historical values. Entries record item, location, signed quantity, unit conversion, movement type, timestamp, actor, and related order, transfer, or count record.

Movement types include opening balance, count adjustment, receipt, consumption, transfer dispatch, transfer receipt, waste / expiration, and reversal.

### Stock visibility

Show on-hand stock, reserved stock if reservation is enabled, available stock, incoming orders, in-transit transfers, count freshness, and low-stock status. Expired or quarantined supplies must be excluded from usable inventory once lot controls are enabled.

The intended balance relationships are:

- `available = usable on-hand − reservations`
- `projected stock = available + eligible incoming stock − uncovered planned demand`

Planned demand and reservations must represent different quantities to avoid subtracting the same demand twice. Unconfirmed orders and overdue incoming shipments must remain visibly distinguishable from reliable incoming stock.

### Low-stock rules

Each location-item pair has its own reorder threshold and target stock level. The threshold determines when to act; the target determines how much to replenish. These are separate fields.

Show actionable states such as count missing, target missing, low stock, healthy, or incoming replenishment. Display the count timestamp so an old count cannot appear current.

## 7. Replenishment and weekly planning

Support two planning modes, with transparent inputs and staff review.

### Manual stock targets

Compare current stock with location-specific thresholds. When replenishment is triggered:

`net need = max(0, target stock − available stock − eligible incoming stock)`

Convert net need into supplier packs and round up. Show how incoming stock affected the suggestion, including the expected arrival date. Users may override a suggestion with a recorded reason.

### Usage-based planning

Use recorded consumption over a selected date range to estimate future needs. Weekly review is the default workflow; week boundaries and forecast horizon must be configurable.

Display separately:

- Patient counts and/or treatment sessions, labeled according to the source report.
- Actual reported consumption for the selected dates.
- Calculated average usage and number of days or weeks included.
- Forecast demand for the selected coverage period.
- Safety stock, usable stock, eligible incoming supply, pack conversion, and suggested purchase quantity.

A proposed calculation is:

`target stock = forecast consumption over lead time and coverage period + safety stock`

The coverage definition must avoid counting lead time twice. Patient attendance alone does not establish supply consumption. Any per-treatment estimate requires an explicit, reviewed assumption and must be labeled as estimated.

Do not automatically subtract both imported usage and a count adjustment that already incorporates that usage. Report imports begin as planning information; posting consumption to the stock ledger requires an agreed reconciliation policy.

## 8. Treatment and medication report integration

### Confirmed operational need

Nurses and technicians record daily activity on existing websites. Novo wants to retrieve reports for a start and end date, usually a week, including patient activity and administered medications or consumed supplies.

The clinical reporting websites have not yet been identified. Cardinal Vantus and Proficient Rx are confirmed purchasing portals; they must not be assumed to be the treatment-report sources.

### Proposed integration sequence

1. Identify each reporting system and its available reports and access permissions.
2. Prefer supported CSV / Excel exports for an initial integration if available.
3. Map source fields and units to the shared catalog.
4. Preview totals, unmatched items, missing units, and duplicate periods before accepting an import.
5. Consider supported APIs or authorized website automation after confirming technical capabilities and access requirements.

Direct login automation is an intended possibility, not a verified capability. Authentication, MFA, session expiry, report formats, and permitted integration methods require investigation. Store credentials through an appropriate secure mechanism, never in the repository or workbook.

### Import requirements

- Record source system, location, reporting interval, source timezone, import time, and uploader.
- Preserve a source identifier or fingerprint for duplicate detection.
- Explicitly define inclusive date boundaries and distinguish unique patients from treatment sessions.
- Show mapping errors and incomplete periods; do not silently substitute zeros.
- Detect overlapping reports and prevent accidental double-counting.
- Support corrected reports with version history and a clear replacement policy.
- Keep raw source totals and normalized values traceable.
- Begin with aggregate operational data. Avoid collecting patient identifiers when aggregated reports satisfy the workflow.

## 9. Orders

### Order lifecycle

Proposed states: **Draft → Pending approval (if required) → Approved → Ordered → Partially received → Received**. Cancellation is available where appropriate. An order is not considered placed merely because a draft exists or a portal link was opened.

### Order information

- Order number, supplier, destination location, creator, and timestamps.
- Line items with supplier item numbers, quantities, purchase units, pack conversions, and optional costs.
- Required-by date, expected delivery date, shipping and tax if tracked.
- Ordering route, confirmation number, external order reference, and notes.
- Approval history when configured.
- Ordered, received, canceled, and outstanding quantity per line.

### Phone orders

Generate a readable and printable supplier/location call sheet. Include supplier contact and account reference where authorized. Staff record the call date, person who took the order, confirmation number, substitutions, backorders, and expected delivery.

### Website orders

Prepare the purchasing list and provide verified supplier or product links. Staff place the order on the supplier website and record its confirmation. Automated checkout and automatic order submission are outside the first release.

### Receiving

Receive against individual order lines, supporting partial deliveries and backorders. Record actual quantity, unit, receiving location, receiver, date, and lot / expiration when required. Only received quantities increase inventory. Duplicate receiving actions must not credit stock twice. Corrections use traceable reversals.

## 10. Inter-location transfer log

### Required information

Transfer ID, sending location, receiving location, item, quantity, unit, request date, dispatcher, receiver, notes, and applicable lot / expiration details.

### Proposed lifecycle and inventory effects

| State / event | Inventory effect |
| --- | --- |
| Requested | No physical stock movement. Reservation is optional and must be explicit. |
| Approved / prepared | May reserve stock if the reservation workflow is enabled. |
| Dispatched / in transit | Reduce source on-hand and move the dispatched quantity into in-transit stock. Release matching reservations. |
| Partially received | Credit only confirmed destination receipts; keep the remainder in transit. |
| Received | Credit the remaining confirmed quantity and close the transfer. |
| Canceled before dispatch | Release any reservation; no physical movement. |
| Discrepancy or return after dispatch | Record missing, damaged, rejected, or returned quantities through explicit resolution movements. |

Reject identical source and destination locations and quantities exceeding available source stock. Receiving must be safe to retry without duplication. The log must retain requested, dispatched, received, and unresolved quantities, staff identities, and timestamps.

A cancellation after dispatch cannot silently return stock to the source. A return must be confirmed physically. In-transit stock should remain visible centrally without appearing available at either location.

## 11. Screens and navigation

| Screen | Intended contents |
| --- | --- |
| Overview | Location filter, low-stock items, missing / stale counts, open orders, incoming deliveries, transfers, and links to action. |
| Inventory | Searchable catalog, category / supplier filters, per-location balances, count entry, units, targets, and movement history. |
| Orders | Supplier/location purchasing lists, order details, approvals if enabled, call sheets, confirmations, and receiving. |
| Transfers | New transfer, source availability, dispatch, receipt confirmation, discrepancies, and searchable history. |
| Usage reports | Location/date filters, patient or treatment totals, item usage, imports, mappings, weekly trends, and planning calculations. |
| Settings | Locations, users and access, supplier contacts and accounts, catalog conversions, reorder rules, and integration settings. |

Tables should work on desktop and offer usable mobile layouts. Forms need clear labels, keyboard support, validation messages, and confirmation of successful actions. Missing data and disconnected integrations must be visible rather than presented as working data.

## 12. Workbook migration

The supplied workbook contains supplier catalogs, Jamaica and Flatland ordering lists, historical master sheets, a Jamaica backup, and a medication summary on `Sheet1`.

### Migration approach

1. Preserve the original workbook unchanged.
2. Read supplier catalogs and location ordering tables into a staging preview.
3. Normalize supplier names, item identifiers, units, and location names while retaining original values.
4. Resolve duplicates, conflicting item numbers, ambiguous package sizes, and blank counts with staff.
5. Treat historical ordering columns as order history, not proof of delivery or current stock.
6. Identify a dated, confirmed opening balance for each location-item pair.
7. Recalculate spreadsheet suggestions in application logic after confirming their business meaning.
8. Import only reviewed records and retain source sheet / row references and batch history.

### Observed issues to address

- Location tables differ in their column layouts and unit fields.
- Some items lack counts, reorder settings, or supplier IDs.
- Current formulas may show an order alert at the reorder level while suggesting zero units. Separate thresholds and replenishment targets resolve this ambiguity.
- Some medication averages are manually entered and differ from the displayed period totals. Recompute from verified source data.
- Backup sheets may repeat earlier records and must not be imported as additional stock.
- Historical counts and order dates must not be presented as current inventory.

The workbook has been reviewed for planning, but no verified production migration has occurred.

## 13. Core data model

| Entity | Key relationships and purpose |
| --- | --- |
| Organization / Location | Ownership, settings, location timezone, and inventory boundaries. |
| User / Membership | Organization role and allowed locations. |
| Item / Unit conversion | Shared catalog and verified quantity conversions. |
| Supplier / Supplier offering | Ordering method, supplier-specific SKU, pack size, price, and product link. |
| Location item policy | Reorder threshold, target, safety stock, lead time, and count freshness settings. |
| Inventory movement / Count | Auditable stock events and physical count observations. |
| Lot | Item, lot identifier, expiration, and disposition where required. |
| Order / Order line / Receipt | Purchase lifecycle and actual stock received. |
| Transfer / Transfer line / Transfer receipt | Inter-location movement and handoff history. |
| Report import / Usage aggregate | Source period, normalized consumption, patient or treatment totals, and import provenance. |
| Audit event | Actor, timestamp, action, affected record, and changes. |

Use stable internal identifiers rather than supplier numbers as primary keys. Store timestamps consistently and display them in the relevant location timezone. Stock-affecting operations require transactional updates and duplicate-action protection.

## 14. Security and operational requirements

- Enforce authentication, role-based permissions, and location access on the server.
- Keep supplier credentials, account references, and report access restricted to authorized users.
- Use encrypted transport and appropriate protection for stored operational data and backups.
- Record audit history for stock changes, orders, approvals, transfers, imports, and settings.
- Define retention, backup, restore, and account deactivation procedures before production use.
- Collect the minimum clinical information required. Patient-level ingestion requires a separate review of privacy, access, retention, and hosting requirements before implementation.
- Do not represent the prototype as compliant with a particular healthcare standard or ready for sensitive patient data.
- Handle concurrent updates without lost counts, duplicate receipts, or negative stock caused by competing transactions.
- Support export of inventory, orders, transfers, and usage summaries for authorized users.

## 15. Delivery phases

### Phase 0 — Interactive sketch (current)

Validate navigation, visual layout, location filtering, inventory count entry, supplier grouping, and transfer handoff using sample data.

### Phase 1 — Shared inventory and purchasing foundation

Add authenticated users, location permissions, a persistent database, reviewed catalog import, verified unit conversions, inventory ledger, manual counts, replenishment targets, supplier order lines, receiving, and complete transfers. Add audit history and operational exports.

### Phase 2 — Weekly reports and forecasting

Identify the clinical reporting sources, implement reviewed export import, reconcile units and duplicate periods, show weekly activity and consumption, and add transparent replenishment forecasts.

### Phase 3 — Supported integrations and refinements

Investigate authorized direct report retrieval, supplier integrations where supported, notifications, lot / expiration features as required, and approval automation. Priorities depend on actual source capabilities and staff feedback.

## 16. Acceptance criteria for the operational foundation

- Authorized staff see inventory only for permitted locations; central operations can compare locations.
- Updating a physical count records the actor, time, unit, reason, and resulting adjustment.
- Missing counts remain distinct from zero stock.
- Verified pack conversions produce consistent balances and whole-pack purchasing suggestions.
- Low-stock alerts use per-location thresholds and display stale or unknown counts.
- Draft orders group items by supplier and destination and remain separate from placed orders.
- Phone and website orders retain confirmation details without implying automated submission.
- Partial receiving credits exactly the received quantities; repeat submission cannot duplicate stock.
- Dispatching a transfer reduces source availability; receipt credits only the confirmed destination quantity.
- Over-dispatch, same-location transfers, duplicate receipts, and unexplained cancellation after dispatch are prevented or explicitly resolved.
- Opening balances and history from the workbook are reviewed before becoming operational data.
- Inventory movements and order / transfer histories remain traceable after corrections.
- Data survives refresh and is consistently visible across authorized staff sessions.

For report readiness, a representative real export must also import with verified dates, units, totals, and duplicate detection before its calculations are trusted for purchasing.

## 17. Open decisions

These are remaining discovery items, not implemented assumptions:

1. Official location names, additional locations, and which users can access each.
2. Clinical reporting website names, report examples, export/API availability, and authentication requirements.
3. Whether patient counts mean unique patients or treatment sessions in each source.
4. Weekly boundaries, planning horizon, lead times, reserve policy, and who approves targets.
5. Verified item/medication package conversions and allocation between Cardinal Vantus and Proficient Rx.
6. Whether supply requests or medication purchases require approval, and by whom.
7. Who counts stock, how often, and whether treatment usage should eventually post consumption automatically.
8. Lot/expiration requirements, transfer authorization, partial transfers, and discrepancy handling.
9. Supplier contacts, verified portal/product links, location account references, and order cutoffs.
10. Hosting, database, sign-in provider, backup/retention policy, and deployment ownership.
11. Whether costs, budgets, purchase attachments, barcode scanning, or notifications are launch requirements or later additions.

## 18. Current implementation and development

**Updated November 2, 2026:** Black Edition is now the main application, imported from the user-supplied six-file ZIP. The product requirements above remain the target; this implementation does not yet satisfy the operational foundation.

### Current Black Edition

- Dark dashboard with Jamaica and Flatlands facility selection, low-stock alerts, and recent check-ins.
- Editable inventory with cases, loose units, units per case, and minimum cases.
- Browser-local persistence, confirmed daily counts, and check-in history.
- Local backup import/export controls.
- Configurable utilization forecasting and CSV export controls, using editable demonstration assumptions.
- Purchasing, orders/deliveries, RenVio report center, and notification placeholders.

There is no authentication, shared database, production inventory ledger, transfer module, completed order/receiving module, or live supplier/clinical integration. Report-source identity remains unverified. Starting forecast inputs are not approved medication or procurement recommendations. A new browser has no initial catalog; the workbook is not automatically imported.

### Earlier sketch

The earlier light prototype is archived in `legacy/light-edition/`, including its sample inventory, in-memory order drafts, and transfer interactions. Its data and behavior are separate from Black Edition. Access it through the development server at `/legacy/light-edition/`.

### Development

Run `npm ci` and `npm run dev` from the repository root. Use Node.js 20.19+ on the 20.x line or 22.12+, preferably a supported LTS release. `npm run build` copies the six static Black Edition files into `dist/`; `npm run preview` serves the result. Classic scripts run in dependency order, without module bundling.

JavaScript syntax, static build, and DOM-based checks passed for startup, navigation, inventory creation/persistence, unconfirmed count rejection, check-in history, forecast settings, and dashboard alerts. These checks do not establish browser visual fidelity, backup/CSV behavior, production security, shared-data correctness, or clinical calculation validity.

Use the existing isolated checkout unless a worktree is explicitly requested. Preserve source workbooks, keep credentials out of source control, and label unimplemented integrations clearly.
