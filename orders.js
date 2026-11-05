
/*
 * NOVO IOS — Orders & Deliveries
 * Local prototype. Does not submit purchases or connect to vendors.
 * Uses existing Inventory API and localStorage backup key novo_ios_orders_v1.
 * Never put patient names, medical records, or other PHI into order notes.
 */
document.addEventListener("DOMContentLoaded", () => {
    "use strict";
  
    const $ = id => document.getElementById(id);
    const host = $("placeholderPage");
    const oldPanel = host?.querySelector(".panel");
    if (!host || !oldPanel || typeof Inventory === "undefined") return;
  
    const KEY = "novo_ios_orders_v1";
    const JOURNAL_KEY = "novo_ios_receipt_pending_v1";
    const VENDORS = ["Fresenius", "Henry Schein", "Cardinal", "Proficient", "Amazon", "Other"];
    const FACILITIES = ["Jamaica", "Flatlands"];
    const MAX_CASES = 100000;
    let orders = [];
    let storageOK = true;
    let pendingReceipt = false;
    let receiving = false;
  
    function id() {
      return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  
    function readOrders() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed) || parsed.some(o => !o || !Array.isArray(o.lines))) {
            throw new Error("Unexpected order history format");
          }
          orders = parsed;
        }
        pendingReceipt = localStorage.getItem(JOURNAL_KEY) !== null;
      } catch (error) {
        console.error("NOVO IOS order storage error:", error);
        storageOK = false;
      }
    }
    readOrders();
  
    function save(next) {
      if (!storageOK || pendingReceipt) {
        throw new Error("Order data is locked. Resolve the storage or receipt warning before making changes.");
      }
      localStorage.setItem(KEY, JSON.stringify(next));
      orders = next;
    }
  
    function node(tag, text, className = "") {
      const e = document.createElement(tag);
      if (text !== undefined && text !== null) e.textContent = String(text);
      if (className) e.className = className;
      return e;
    }
    function td(tr, content, className = "") {
      const c = node("td", content, className);
      tr.appendChild(c);
      return c;
    }
    const format = n => Number(n).toLocaleString("en-US");
    const money = cents => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const today = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const shortDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not set";
    function count(raw, label, maximum = MAX_CASES) {
      const str = String(raw).trim();
      const n = Number(str);
      if (str === "" || !Number.isSafeInteger(n) || n < 0 || n > maximum) {
        throw new Error(`${label} must be a whole number from 0 to ${format(maximum)}.`);
      }
      return n;
    }
    function priceCents(raw, label) {
      const str = String(raw).trim();
      if (str === "") return null;
      if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(str)) throw new Error(`${label}: enter a valid price (up to two decimals).`);
      const cents = Math.round(Number(str) * 100);
      if (!Number.isSafeInteger(cents) || cents > 100000000) throw new Error(`${label}: price is too large.`);
      return cents;
    }
    function state(order) {
      if (order.cancelled) return "Cancelled";
      if (order.closedShort) return "Closed short";
      const ordered = order.lines.reduce((s, l) => s + l.orderedCases * l.caseSize, 0);
      const received = order.lines.reduce((s, l) => s + (l.receivedUnits || 0), 0);
      if (ordered > 0 && received >= ordered) return "Received";
      if (received > 0) return "Partially received";
      return order.placedAt || (order.legacyPlaced === true) ? "Ordered" : "Draft";
    }
    function remaining(line) {
      return line.orderedCases * line.caseSize - (line.receivedUnits || 0);
    }
    function textStatus(message, error = false) {
      const target = $("ordersMessage");
      target.textContent = message;
      target.className = error ? "orders-error" : "orders-success";
    }
    function priceHistory(item) {
      const matches = [];
      orders.forEach(order => {
        if (order.facility !== item.facility || order.vendor !== item.vendor || order.cancelled) return;
        order.lines.forEach(line => {
          if (line.inventoryId !== item.id) return;
          const cents = typeof line.priceCents === "number"
            ? line.priceCents
            : (typeof line.price === "number" ? Math.round(line.price * 100) : null);
          if (cents !== null) matches.push({ cents, at: order.createdAt || "" });
        });
      });
      matches.sort((a, b) => b.at.localeCompare(a.at));
      return matches[0]?.cents ?? null;
    }
  
    const panel = node("section", null, "panel hidden");
    panel.id = "ordersModule";
    panel.innerHTML = `
      <div class="orders-hero">
        <div>
          <div class="panel-kicker">PURCHASING / RECEIVING</div>
          <h2>Orders & Deliveries</h2>
          <p class="muted">From supplier requests to verified stock on your shelves.</p>
        </div>
        <button type="button" class="secondary-btn" id="ordersExport">Export order history (CSV)</button>
      </div>
      <div class="orders-notice">LOCAL PROTOTYPE — Saving an order here does <strong>not</strong> send it to any supplier. Only confirmed packing-slip receipts increase inventory. Records stay in this browser.</div>
      <div id="ordersIntegrity" class="orders-danger hidden" role="alert"></div>
      <div class="orders-overview" id="ordersOverview"></div>
  
      <section class="orders-subpanel">
        <div class="orders-subhead"><div><div class="panel-kicker">01 / PREPARE</div><h3>Create a purchase order</h3><p class="muted">Choose the facility and vendor. Products from either center are available; on-hand quantities are for the selected facility only.</p></div></div>
        <form id="ordersCreateForm">
          <div class="orders-fields">
            <label>Facility<select id="ordersFacility"><option value="Jamaica">Jamaica (NDJ)</option><option value="Flatlands">Flatlands (NDF)</option></select></label>
            <label>Vendor<select id="ordersVendor"></select></label>
            <label>Expected delivery<input id="ordersExpected" type="date"></label>
            <label>Vendor confirmation #<input id="ordersReference" maxlength="100" placeholder="Optional; add after calling"></label>
          </div>
          <label class="orders-notes-label">Internal notes (no patient information)<textarea id="ordersNotes" rows="2" maxlength="500" placeholder="Example: Requested Monday shipment; waiting for confirmation"></textarea></label>
          <div class="orders-table-heading"><strong>Order items</strong><button type="button" class="text-link" id="ordersSuggest">Fill minimum-stock shortages</button></div>
          <div class="table-wrap"><table class="orders-builder-table"><thead><tr><th>Product / SKU</th><th>On hand</th><th>Minimum shortage</th><th>Order cases</th><th>Price / case</th><th>Last price</th></tr></thead><tbody id="ordersBuilder"></tbody></table></div>
          <p id="ordersNoProducts" class="empty-state hidden">No products registered for this vendor. Add a product in Inventory first.</p>
          <div class="orders-form-footer"><span id="ordersEstimate" class="muted">No cases selected</span><button type="submit" class="primary-btn">Save draft order</button></div>
        </form>
      </section>
  
      <section class="orders-subpanel">
        <div class="orders-subhead"><div><div class="panel-kicker">02 / FOLLOW THROUGH</div><h3>Purchase orders & receiving</h3><p class="muted">Mark orders as placed only after you contact the vendor. Then reconcile each arriving packing slip.</p></div>
          <label class="orders-filter">Show<select id="ordersStatusFilter"><option value="active">Active</option><option value="all">All orders</option><option value="draft">Drafts</option><option value="completed">Completed / closed</option><option value="cancelled">Cancelled</option></select></label>
        </div>
        <div id="ordersList"></div>
      </section>
      <p id="ordersMessage" role="status" aria-live="polite"></p>
    `;
    host.appendChild(panel);
    VENDORS.forEach(vendor => $("ordersVendor").appendChild(new Option(vendor, vendor)));
    $("ordersFacility").value = $("facilitySelect").value === "Flatlands" ? "Flatlands" : "Jamaica";
  
    function showIntegrity() {
      const issues = [];
      if (!storageOK) issues.push("Saved order data could not be read. No changes are permitted until the browser storage is repaired.");
      if (pendingReceipt) issues.push("An interrupted delivery receipt was detected. Stop receiving and reconcile the physical inventory, purchase-order receipt history, and browser backup before proceeding. Do not delete the recovery record without reconciling.");
      if (!Inventory.isStorageAvailable()) issues.push("Inventory browser storage is unavailable. Resolve this before saving deliveries.");
      const warning = $("ordersIntegrity");
      warning.textContent = issues.join(" ");
      warning.classList.toggle("hidden", issues.length === 0);
      $("ordersCreateForm").querySelector('button[type="submit"]').disabled = issues.length > 0;
    }
  
    // Use a shared vendor catalog when preparing orders, even if a product is
    // currently registered at only one facility. Prefer the selected site's
    // physical stock record whenever it exists. Do not invent stock on screen.
    function choices() {
      const selected = $("ordersFacility").value;
      const vendor = $("ordersVendor").value;
      const byProduct = new Map();
      const candidates = Inventory.all().filter(item => item.vendor === vendor)
        .sort((a, b) => (a.facility === selected ? -1 : 0) - (b.facility === selected ? -1 : 0));
      for (const item of candidates) {
        const sku = item.sku.trim().toLowerCase();
        const key = item.sharedProductId
          ? `shared:${item.sharedProductId}`
          : sku ? `sku:${item.vendor}:${sku}:${item.caseSize}`
            : `name:${item.vendor}:${item.name.trim().toLowerCase()}:${item.caseSize}`;
        if (!byProduct.has(key)) byProduct.set(key, item);
      }
      return [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    function renderBuilder() {
      const tbody = $("ordersBuilder");
      tbody.replaceChildren();
      const products = choices();
      for (const item of products) {
        const row = node("tr");
        row.dataset.itemId = item.id;
        const name = td(row, item.name, "product-name");
        if (item.sku) name.appendChild(node("small", `SKU: ${item.sku}`, "item-sku"));
        const missingAtSite = item.facility !== $("ordersFacility").value;
        td(row, missingAtSite ? "0 units · Not stocked here yet" : `${format(Inventory.totalUnits(item))} units`);
        const suggestion = missingAtSite ? null : Inventory.casesToOrder(item);
        td(row, missingAtSite ? "Set facility minimum" : suggestion === null ? "Minimum needs review" : `${suggestion} case${suggestion === 1 ? "" : "s"}`);
        const qtyTd = td(row, "");
        const qty = node("input");
        Object.assign(qty, { type: "number", min: "0", max: String(MAX_CASES), step: "1", value: "0", className: "orders-number" });
        qty.dataset.role = "cases";
        qty.setAttribute("aria-label", `Cases to order: ${item.name}`);
        qtyTd.appendChild(qty);
        const priceTd = td(row, "");
        const price = node("input");
        Object.assign(price, { type: "number", min: "0", step: "0.01", placeholder: "Optional", className: "orders-number" });
        price.dataset.role = "price";
        price.setAttribute("aria-label", `Price per case: ${item.name}`);
        priceTd.appendChild(price);
        const prior = priceHistory(item);
        const history = td(row, prior === null ? "No history" : money(prior), "orders-prior-price");
        if (prior !== null) history.dataset.previous = String(prior);
        tbody.appendChild(row);
      }
      $("ordersNoProducts").classList.toggle("hidden", products.length > 0);
      updateEstimate();
    }
    function updateEstimate() {
      let cases = 0;
      let total = 0;
      let unpriced = false;
      let increases = 0;
      for (const tr of $("ordersBuilder").rows) {
        const n = Number(tr.querySelector('[data-role="cases"]').value) || 0;
        if (n <= 0) continue;
        cases += n;
        const raw = tr.querySelector('[data-role="price"]').value;
        const cents = /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : null;
        if (cents === null) unpriced = true;
        else total += n * cents;
        const prior = tr.querySelector(".orders-prior-price")?.dataset.previous;
        if (prior && cents !== null && cents > Number(prior)) increases++;
      }
      const totalMessage = unpriced ? `Known subtotal: ${money(total)} (excludes unpriced lines)` : `Estimated total: ${money(total)}`;
      $("ordersEstimate").textContent = cases ? `${format(cases)} cases · ${totalMessage}${increases ? ` · ${increases} price increase(s)` : ""}` : "No cases selected";
    }
  
    function renderOverview() {
      const visible = filteredOrders();
      const pending = visible.filter(o => ["Draft", "Ordered", "Partially received"].includes(state(o))).length;
      const partial = visible.filter(o => state(o) === "Partially received").length;
      const due = visible.filter(o => ["Ordered", "Partially received"].includes(state(o)) && o.expected && o.expected < today()).length;
      const summary = $("ordersOverview");
      summary.replaceChildren();
      [["Active orders", pending, "clipboard"], ["Partially received", partial, "truck"], ["Past expected date", due, "alert"]].forEach(([label, value, icon]) => {
        const box = node("div", null, "orders-metric");
        const iconSpan = node("span", icon === "alert" ? "!" : icon === "truck" ? "↘" : "#", "orders-metric-icon");
        box.append(node("span", label, "orders-metric-label"), node("strong", value), iconSpan);
        summary.appendChild(box);
      });
    }
    function filteredOrders() {
      // Keep the orders list aligned with the location chosen in the order form.
      // The global Both view remains an overview of all open orders.
      const selected = $("facilitySelect").value === "Both" ? "Both" : $("ordersFacility").value;
      return orders.filter(order => selected === "Both" || order.facility === selected);
    }
    function lineCost(line) {
      return typeof line.priceCents === "number" ? line.priceCents : (typeof line.price === "number" ? Math.round(line.price * 100) : null);
    }
    function orderCost(order) {
      return order.lines.reduce((a, line) => {
        const price = lineCost(line);
        if (price === null) a.missing = true;
        else a.cents += line.orderedCases * price;
        return a;
      }, { cents: 0, missing: false });
    }
    function makeField(label, type, value, maxLength) {
      const wrap = node("label", null, "orders-detail-field");
      wrap.appendChild(node("span", label));
      const input = node("input");
      input.type = type;
      input.value = value || "";
      if (maxLength) input.maxLength = maxLength;
      wrap.appendChild(input);
      return { wrap, input };
    }
    function renderOrders() {
      const filter = $("ordersStatusFilter").value;
      const list = $("ordersList");
      list.replaceChildren();
      const visible = filteredOrders()
        .filter(o => {
          const s = state(o);
          return filter === "all" || (filter === "active" && ["Draft", "Ordered", "Partially received"].includes(s)) ||
            (filter === "draft" && s === "Draft") ||
            (filter === "completed" && ["Received", "Closed short"].includes(s)) ||
            (filter === "cancelled" && s === "Cancelled");
        })
        .slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      if (!visible.length) {
        const msg = node("div", null, "orders-empty");
        msg.append(node("strong", "No orders in this view"), node("p", "Create a draft above, or change the facility or status filter."));
        list.appendChild(msg);
        return;
      }
      for (const order of visible) {
        const status = state(order);
        const article = node("article", null, "orders-card");
        article.dataset.orderId = order.id;
        const head = node("div", null, "orders-card-head");
        const info = node("div");
        info.append(node("span", `PO · ${order.id.slice(0, 8).toUpperCase()}`, "orders-overline"), node("h4", `${order.vendor} · ${order.facility}`));
        info.append(node("p", `Created ${new Date(order.createdAt).toLocaleDateString()} · Expected ${shortDate(order.expected)} · ${order.reference ? `Ref ${order.reference}` : "No confirmation number"}`, "muted"));
        const statusLabel = node("span", status, `orders-state orders-state-${status.toLowerCase().replace(/\W+/g, "-")}`);
        head.append(info, statusLabel);
        article.appendChild(head);
        const costs = orderCost(order);
        article.appendChild(node("p", costs.missing ? `Known purchase subtotal: ${money(costs.cents)} (some prices not entered)` : `Purchase total: ${money(costs.cents)}`, "orders-price-total"));
  
        const details = node("div", null, "orders-edit-grid");
        const reference = makeField("Vendor confirmation #", "text", order.reference, 100);
        const expected = makeField("Expected delivery", "date", order.expected);
        reference.input.dataset.field = "reference";
        expected.input.dataset.field = "expected";
        details.append(reference.wrap, expected.wrap);
        const noteWrap = node("label", null, "orders-detail-field orders-detail-notes");
        noteWrap.appendChild(node("span", "Internal notes (no patient information)"));
        const notes = node("textarea");
        Object.assign(notes, { value: order.notes || "", maxLength: 500, rows: 2 });
        notes.dataset.field = "notes";
        noteWrap.appendChild(notes);
        details.appendChild(noteWrap);
        if (!["Cancelled", "Received", "Closed short"].includes(status)) {
          const saveDetails = node("button", "Save details", "secondary-btn");
          saveDetails.type = "button";
          saveDetails.dataset.action = "details";
          details.appendChild(saveDetails);
        } else {
          reference.input.disabled = true;
          expected.input.disabled = true;
          notes.disabled = true;
        }
        article.appendChild(details);
  
        const wrap = node("div", null, "table-wrap");
        const table = node("table", null, "orders-receiving-table");
        const header = node("thead");
        const headerRow = node("tr");
        ["Product", "Ordered", "Already received", "Still outstanding", "Price / case", "This delivery — cases", "Loose units"].forEach(label => headerRow.appendChild(node("th", label)));
        header.appendChild(headerRow);
        table.appendChild(header);
        const body = node("tbody");
        for (const line of order.lines) {
          const tr = node("tr");
          tr.dataset.lineId = line.id;
          const name = td(tr, line.name, "product-name");
          if (line.sku) name.appendChild(node("small", line.sku, "item-sku"));
          td(tr, `${format(line.orderedCases)} cases`);
          td(tr, `${format(line.receivedUnits || 0)} units`);
          const outstanding = remaining(line);
          td(tr, `${format(outstanding)} units`, outstanding ? "orders-outstanding" : "orders-fulfilled");
          const cents = lineCost(line);
          td(tr, cents === null ? "—" : money(cents));
          for (const field of ["cases", "loose"]) {
            const target = td(tr, "");
            if (!["Cancelled", "Received", "Closed short", "Draft"].includes(status) && outstanding > 0) {
              const input = node("input");
              Object.assign(input, { type: "number", min: "0", max: String(MAX_CASES), step: "1", value: "0", className: "orders-number" });
              input.dataset.receive = field;
              input.setAttribute("aria-label", `${field} received: ${line.name}`);
              target.appendChild(input);
            } else {
              target.textContent = "—";
            }
          }
          body.appendChild(tr);
        }
        table.appendChild(body);
        wrap.appendChild(table);
        article.appendChild(wrap);
  
        if (["Ordered", "Partially received"].includes(status)) {
          const receivingForm = node("div", null, "orders-receipt-footer");
          const slip = makeField("Packing slip / delivery #", "text", "", 100);
          slip.input.dataset.receiveMeta = "slip";
          slip.input.required = true;
          const date = makeField("Date received", "date", today());
          date.input.dataset.receiveMeta = "date";
          date.input.required = true;
          receivingForm.append(slip.wrap, date.wrap);
          const post = node("button", "Post verified delivery", "primary-btn");
          post.type = "button";
          post.dataset.action = "receive";
          receivingForm.appendChild(post);
          article.appendChild(receivingForm);
          article.appendChild(node("p", "Enter the cases and loose units shown on this packing slip. Leave undelivered lines at zero. Posting adds verified units to Inventory.", "orders-caption"));
        }
        const controls = node("div", null, "orders-card-actions");
        if (status === "Draft") {
          const mark = node("button", "Mark placed with vendor", "primary-btn");
          mark.type = "button"; mark.dataset.action = "place";
          controls.append(mark);
        }
        if (["Draft", "Ordered"].includes(status)) {
          const cancel = node("button", "Cancel order", "secondary-btn");
          cancel.type = "button"; cancel.dataset.action = "cancel";
          controls.append(cancel);
        }
        if (status === "Partially received") {
          const close = node("button", "Close remaining as unfulfilled", "secondary-btn");
          close.type = "button"; close.dataset.action = "close-short";
          controls.append(close);
        }
        if (controls.childNodes.length) article.appendChild(controls);
  
        const receipts = Array.isArray(order.receipts) ? order.receipts : [];
        if (receipts.length) {
          const history = node("details", null, "orders-history");
          history.appendChild(node("summary", `Delivery history · ${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`));
          const historyBody = node("div", null, "orders-history-body");
          for (const receipt of receipts) {
            const delivery = node("div", null, "orders-history-entry");
            const entries = Array.isArray(receipt.entries) ? receipt.entries : [receipt]; // read legacy per-line receipts
            const totalUnits = entries.reduce((s, r) => s + (r.units || 0), 0);
            delivery.append(node("strong", `${receipt.slip || "Legacy receipt (no slip #)"} · ${shortDate((receipt.date || "").slice(0, 10))}`));
            delivery.append(node("small", `${format(totalUnits)} units · ${entries.map(e => `${e.name}: ${e.cases || 0} cases + ${e.loose || 0} loose`).join("; ")}`));
            historyBody.appendChild(delivery);
          }
          history.appendChild(historyBody);
          article.appendChild(history);
        }
        list.appendChild(article);
      }
    }
  
    function render() {
      showIntegrity();
      renderBuilder();
      renderOverview();
      renderOrders();
    }
    function sync() {
      const show = $("pageTitle").textContent.trim() === "Orders & Deliveries" && !host.classList.contains("hidden");
      oldPanel.classList.toggle("hidden", show);
      panel.classList.toggle("hidden", !show);
      if (show) {
        const global = $("facilitySelect").value;
        if (FACILITIES.includes(global)) $("ordersFacility").value = global;
        render();
      }
    }
  
    $("ordersFacility").addEventListener("change", () => {
      renderBuilder();
      renderOverview();
      renderOrders();
    });
    $("ordersVendor").addEventListener("change", renderBuilder);
    $("ordersStatusFilter").addEventListener("change", renderOrders);
    $("ordersBuilder").addEventListener("input", updateEstimate);
    $("ordersSuggest").addEventListener("click", () => {
      for (const tr of $("ordersBuilder").rows) {
        const item = Inventory.find(tr.dataset.itemId);
        const suggestion = item && item.facility === $("ordersFacility").value ? Inventory.casesToOrder(item) : null;
        tr.querySelector('[data-role="cases"]').value = suggestion === null ? "0" : String(suggestion);
      }
      updateEstimate();
    });
    $("ordersCreateForm").addEventListener("submit", event => {
      event.preventDefault();
      try {
        if (!storageOK || pendingReceipt || !Inventory.isStorageAvailable()) throw new Error("Storage is not ready. Check the warning above.");
        const facility = $("ordersFacility").value;
        const vendor = $("ordersVendor").value;
        const selected = [];
        // Validate the entire order BEFORE modifying any inventory records.
        for (const tr of $("ordersBuilder").rows) {
          const product = Inventory.find(tr.dataset.itemId);
          if (!product || product.vendor !== vendor) throw new Error("A product changed during entry. Reopen the order builder.");
          const qty = count(tr.querySelector('[data-role="cases"]').value, `${product.name}: cases`);
          const cost = priceCents(tr.querySelector('[data-role="price"]').value, `${product.name} price`);
          if (qty > 0) selected.push({ product, qty, cost });
        }
        if (!selected.length) throw new Error("Enter at least one quantity greater than zero.");
        // A catalog product from the other center gets a ZERO-stock record at
        // the selected site. Existing quantities are never copied or pooled.
        const siteIds = Inventory.ensureForFacility(selected.map(s => s.product.id), facility, vendor);
        const lines = selected.map(({ product, qty, cost }) => ({
          id: id(), inventoryId: siteIds[product.id], name: product.name, sku: product.sku,
          caseSize: product.caseSize, orderedCases: qty, receivedUnits: 0, priceCents: cost
        }));
        const order = { id: id(), createdAt: new Date().toISOString(), facility, vendor, expected: $("ordersExpected").value, reference: $("ordersReference").value.trim(), notes: $("ordersNotes").value.trim(), placedAt: null, cancelled: false, closedShort: false, lines, receipts: [] };
        save([...orders, order]);
        $("ordersCreateForm").reset();
        $("ordersFacility").value = facility;
        $("ordersVendor").value = vendor;
        $("ordersStatusFilter").value = "active";
        render();
        textStatus(`Draft saved for ${vendor} · ${facility}. No purchase has been sent to the supplier.`);
      } catch (error) {
        textStatus(error.message || "Could not save purchase order.", true);
      }
    });
  
    $("ordersList").addEventListener("click", event => {
      const btn = event.target.closest("button[data-action]");
      if (!btn || receiving) return;
      const article = btn.closest(".orders-card");
      const orderId = article?.dataset.orderId;
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      try {
        const action = btn.dataset.action;
        const status = state(order);
        if (pendingReceipt || !storageOK || !Inventory.isStorageAvailable()) throw new Error("Cannot change orders while there is a storage or receipt warning.");
        if (action === "details") {
          if (["Cancelled", "Received", "Closed short"].includes(status)) throw new Error("This order is closed.");
          const ref = article.querySelector('[data-field="reference"]').value.trim();
          const expected = article.querySelector('[data-field="expected"]').value;
          const notes = article.querySelector('[data-field="notes"]').value.trim();
          if (ref.length > 100 || notes.length > 500) throw new Error("Confirmation or notes are too long.");
          save(orders.map(o => o.id === orderId ? { ...o, reference: ref, expected, notes } : o));
          renderOverview(); renderOrders(); textStatus("Order details saved.");
        } else if (action === "place") {
          if (status !== "Draft") throw new Error("Only draft orders can be marked placed.");
          if (!confirm(`Have you actually placed this order with ${order.vendor}? NOVO IOS will not submit it for you.`)) return;
          const ref = article.querySelector('[data-field="reference"]').value.trim();
          const expected = article.querySelector('[data-field="expected"]').value;
          const notes = article.querySelector('[data-field="notes"]').value.trim();
          save(orders.map(o => o.id === orderId ? { ...o, placedAt: new Date().toISOString(), reference: ref, expected, notes } : o));
          renderOverview(); renderOrders(); textStatus(`Marked ${order.vendor} order as placed. Await actual delivery.`);
        } else if (action === "cancel") {
          if (!["Draft", "Ordered"].includes(status)) throw new Error("Orders with receipts cannot be cancelled. Close any remaining balance instead.");
          if (!confirm("Cancel this order locally? This does NOT cancel anything with the vendor.")) return;
          save(orders.map(o => o.id === orderId ? { ...o, cancelled: true } : o));
          renderOverview(); renderOrders(); textStatus("Order cancelled in NOVO IOS. No inventory was changed.");
        } else if (action === "close-short") {
          if (status !== "Partially received") throw new Error("Only partially received orders can be closed short.");
          if (!confirm("Close all outstanding quantities as unfulfilled? They will NOT be added to inventory.")) return;
          save(orders.map(o => o.id === orderId ? { ...o, closedShort: true } : o));
          renderOverview(); renderOrders(); textStatus("Outstanding quantities closed as unfulfilled. Stock was unchanged.");
        } else if (action === "receive") {
          receive(order, article);
        }
      } catch (error) {
        console.error(error);
        showIntegrity();
        textStatus(error.message || "Order action failed.", true);
      }
    });
  
    function receive(order, article) {
      if (!["Ordered", "Partially received"].includes(state(order))) throw new Error("Mark the order as placed before receiving it.");
      const slip = article.querySelector('[data-receive-meta="slip"]').value.trim();
      const date = article.querySelector('[data-receive-meta="date"]').value;
      if (!slip) throw new Error("Enter the packing slip or delivery reference before posting.");
      if (slip.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Enter a valid slip reference and received date.");
      const selections = [];
      for (const tr of article.querySelectorAll("tbody tr[data-line-id]")) {
        const line = order.lines.find(l => l.id === tr.dataset.lineId);
        if (!line) throw new Error("An order line has changed. Refresh the page.");
        const inputCases = tr.querySelector('[data-receive="cases"]');
        const inputLoose = tr.querySelector('[data-receive="loose"]');
        if (!inputCases || !inputLoose) continue;
        const cases = count(inputCases.value, `${line.name}: delivered cases`);
        const loose = count(inputLoose.value, `${line.name}: delivered loose units`, MAX_CASES * line.caseSize);
        const units = cases * line.caseSize + loose;
        if (!Number.isSafeInteger(units) || units > remaining(line)) {
          throw new Error(`${line.name}: receipt exceeds the ${format(remaining(line))} outstanding units.`);
        }
        if (units > 0) {
          const stock = Inventory.find(line.inventoryId);
          if (!stock || stock.facility !== order.facility || stock.vendor !== order.vendor || stock.caseSize !== line.caseSize) {
            throw new Error(`${line.name}: inventory entry is missing or changed. Verify its facility, vendor, case size, and minimum in Inventory before posting.`);
          }
          const newTotal = Inventory.totalUnits(stock) + units;
          if (!Number.isSafeInteger(newTotal)) throw new Error(`${line.name}: inventory quantity exceeds safe limits.`);
          selections.push({ line, stock, cases, loose, units, newTotal });
        }
      }
      if (!selections.length) throw new Error("Enter at least one delivered case or loose unit.");
      const summary = selections.map(s => `${s.line.name}: ${s.cases} cases + ${s.loose} loose`).join("\n");
      if (!confirm(`Verify packing slip ${slip} for ${order.facility}:\n\n${summary}\n\nAdd these quantities to inventory?`)) return;
  
      // Browser localStorage cannot make atomic transactions across two keys.
      // A durable journal blocks additional receipts if the browser closes mid-post.
      receiving = true;
      const beforeOrders = orders;
      const previous = selections.map(s => ({ ...s.stock }));
      const postedAt = new Date().toISOString();
      const receiptId = id();
      const entries = selections.map(s => ({ lineId: s.line.id, name: s.line.name, cases: s.cases, loose: s.loose, units: s.units }));
      const nextOrders = orders.map(o => o.id !== order.id ? o : {
        ...o,
        lines: o.lines.map(line => {
          const selected = selections.find(s => s.line.id === line.id);
          return selected ? { ...line, receivedUnits: (line.receivedUnits || 0) + selected.units } : line;
        }),
        receipts: [...(o.receipts || []), { id: receiptId, date, postedAt, slip, entries }]
      });
      let journalWritten = false;
      try {
        localStorage.setItem(JOURNAL_KEY, JSON.stringify({ receiptId, orderId: order.id, date: postedAt, before: previous.map(s => ({ id: s.id, cases: s.cases, loose: s.loose })), slip }));
        journalWritten = true;
        for (const s of selections) {
          Inventory.upsert({ ...s.stock, cases: Math.floor(s.newTotal / s.stock.caseSize), loose: s.newTotal % s.stock.caseSize });
        }
        // Bypass save() while the journal exists, but don't mutate in-memory state until stored.
        localStorage.setItem(KEY, JSON.stringify(nextOrders));
        orders = nextOrders;
        localStorage.removeItem(JOURNAL_KEY);
        journalWritten = false;
        pendingReceipt = false;
        renderOverview(); renderOrders();
        textStatus(`Packing slip ${slip} posted: ${format(entries.reduce((sum, e) => sum + e.units, 0))} verified units added to ${order.facility} inventory.`);
      } catch (error) {
        // Restore both stores if anything fails. If rollback also fails, keep
        // the journal and prohibit further receiving until reconciliation.
        let rollbackOK = true;
        for (const stock of previous) {
          try { Inventory.upsert(stock); } catch (e) { rollbackOK = false; console.error("Inventory rollback failed:", e); }
        }
        try { localStorage.setItem(KEY, JSON.stringify(beforeOrders)); orders = beforeOrders; }
        catch (e) { rollbackOK = false; console.error("Order rollback failed:", e); }
        if (journalWritten && rollbackOK) {
          try { localStorage.removeItem(JOURNAL_KEY); journalWritten = false; }
          catch (e) { rollbackOK = false; console.error("Receipt journal cleanup failed:", e); }
        }
        pendingReceipt = !rollbackOK;
        if (pendingReceipt) throw new Error("IMPORTANT: Receipt saving failed and rollback could not be confirmed. Stop receiving and reconcile stock and order records manually.");
        throw new Error(`Receipt not saved; inventory and orders restored. ${error.message}`);
      } finally {
        receiving = false;
        showIntegrity();
      }
    }
  
    $("ordersExport").addEventListener("click", () => {
      if (!orders.length) return textStatus("No order history to export yet.", true);
      const rows = [["PO ID", "Facility", "Vendor", "Created", "Status", "Expected delivery", "Confirmation", "Product", "SKU", "Cases ordered", "Units per case", "Units received", "Units outstanding", "Price per case", "Packing slip references"]];
      for (const order of filteredOrders()) {
        const slips = (order.receipts || []).map(r => r.slip || "").filter(Boolean).join("; ");
        for (const line of order.lines) rows.push([order.id, order.facility, order.vendor, order.createdAt, state(order), order.expected || "", order.reference || "", line.name, line.sku || "", line.orderedCases, line.caseSize, line.receivedUnits || 0, remaining(line), lineCost(line) === null ? "" : (lineCost(line) / 100).toFixed(2), slips]);
      }
      // Prevent spreadsheet formula injection in exported text fields.
      const escape = x => {
        const raw = String(x);
        const safe = /^[\s]*[=+@-]/.test(raw) && typeof x === "string" ? "'" + raw : raw;
        return `"${safe.replaceAll('"', '""')}"`;
      };
      const csv = rows.map(row => row.map(escape).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = node("a");
      a.href = url;
      a.download = `novo-ios-orders-${today()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      textStatus("Order history CSV exported. Backup/restore of the original records is available from the Dashboard.");
    });
  
    document.addEventListener("click", event => {
      if (event.target.closest("[data-page], [data-goto]")) sync();
    });
    $("facilitySelect").addEventListener("change", () => {
      if (!panel.classList.contains("hidden")) {
        const selected = $("facilitySelect").value;
        if (FACILITIES.includes(selected)) $("ordersFacility").value = selected;
        render();
      }
    });
    showIntegrity();
  });
  
