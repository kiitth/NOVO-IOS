
    // NOVO IOS - page controls, inventory, and daily morning count.
    document.addEventListener("DOMContentLoaded", () => {
      const $ = id => document.getElementById(id);
      const pageNames = {
        dashboard: "Dashboard", inventory: "Inventory",
        checkin: "Daily Check-In", forecasting: "Forecasting",
        purchasing: "Vendor Purchasing Hub", orders: "Orders & Deliveries",
        renvio: "RenVio Report Center", notifications: "Notifications"
      };
      let currentPage = "dashboard";
      let checkinDraft = [];
      let draftChanged = false;
    
      function facility() { return $("facilitySelect").value; }
      function numberFromInput(value, label, minimum = 0) {
        if (String(value).trim() === "") throw new Error(`${label} cannot be blank.`);
        const n = Number(value);
        if (!Number.isSafeInteger(n) || n < minimum) throw new Error(`${label} must be a whole number of at least ${minimum}.`);
        return n;
      }
      function makeCell(row, value, className = "") {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        if (className) cell.className = className;
        row.appendChild(cell);
        return cell;
      }
      function button(text, action, id) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = action === "delete" ? "text-button danger-text" : "text-button";
        element.dataset.action = action;
        element.dataset.id = id;
        element.textContent = text;
        return element;
      }
      function showStorageWarning() {
        $("storageWarning").classList.toggle("hidden", Inventory.isStorageAvailable());
      }
      function showPage(page) {
        if (!Object.prototype.hasOwnProperty.call(pageNames, page)) page = "dashboard";
        if (currentPage === "checkin" && page !== "checkin" && draftChanged &&
            !confirm("Leave the check-in? Your unsaved counts will be lost.")) return;
        const enteringCheckin = page === "checkin" && currentPage !== "checkin";
        currentPage = page;
        $("pageTitle").textContent = pageNames[page];
        for (const key of ["dashboard", "inventory", "checkin"]) {
          $(`${key}Page`).classList.toggle("hidden", key !== page);
        }
        $("placeholderPage").classList.toggle("hidden", ["dashboard", "inventory", "checkin"].includes(page));
        $("placeholderTitle").textContent = pageNames[page];
        document.querySelectorAll("[data-page]").forEach(nav => {
          const active = nav.dataset.page === page;
          nav.classList.toggle("active", active);
          if (active) nav.setAttribute("aria-current", "page");
          else nav.removeAttribute("aria-current");
        });
        if (enteringCheckin) {
          if (facility() !== "Both") $("checkinFacility").value = facility();
          initCheckinDraft();
        }
        render();
      }
      function openInventoryFilter(filter) {
        $("stockFilter").value = filter;
        $("inventorySearch").value = "";
        $("vendorFilter").value = "All";
        showPage("inventory");
      }
    
      function renderDashboard() {
        const visible = Inventory.getVisible(facility());
        $("statItems").textContent = visible.length;
        $("statLow").textContent = visible.filter(Inventory.isLow).length;
        $("statReview").textContent = visible.filter(Inventory.needsReview).length;
        $("statFacility").textContent = facility() === "Both" ? "BOTH" : facility() === "Jamaica" ? "NDJ" : "NDF";
      }
      function renderInventory() {
        const all = Inventory.getVisible(facility());
        const term = $("inventorySearch").value.trim().toLowerCase();
        const vendor = $("vendorFilter").value;
        const stock = $("stockFilter").value;
        const rows = all.filter(item => {
          if (vendor !== "All" && item.vendor !== vendor) return false;
          if (term && !`${item.name} ${item.sku} ${item.vendor}`.toLowerCase().includes(term)) return false;
          if (stock === "low" && !Inventory.isLow(item)) return false;
          if (stock === "review" && !Inventory.needsReview(item)) return false;
          return true;
        }).sort((a,b) => a.name.localeCompare(b.name));
        // Show a shared product only ONCE in Both Facilities view,
        // while displaying each facility's stock independently.
        const seen = new Set();
        const displayRows = rows.filter(item => {
          if (facility() !== "Both" || !item.sharedProductId) return true;
          if (seen.has(item.sharedProductId)) return false;
          seen.add(item.sharedProductId);
          return true;
        });
        const table = $("inventoryTable");
        table.replaceChildren();
        for (const item of displayRows) {
          const linked = facility() === "Both" && item.sharedProductId
            ? Inventory.all().filter(other => other.sharedProductId === item.sharedProductId)
            : null;
          const stocks = linked && linked.length > 1 ? linked : null;
          const perSite = (fn) => stocks.map(row => `${row.facility === "Jamaica" ? "NDJ" : "NDF"}: ${fn(row)}`).join(" / ");
          const tr = document.createElement("tr");
          const name = makeCell(tr, item.name, "product-name");
          if (item.sku) {
            const small = document.createElement("small");
            small.className = "item-sku";
            small.textContent = item.sku;
            name.appendChild(small);
          }
          makeCell(tr, item.vendor, item.vendor === "Fresenius" ? "fresenius-text" : item.vendor === "Henry Schein" ? "henry-text" : "");
          makeCell(tr, stocks ? "Both (NDJ + NDF)" : item.facility === "Jamaica" ? "Jamaica (NDJ)" : "Flatlands (NDF)");
          makeCell(tr, stocks ? perSite(r => r.cases) : item.cases);
          makeCell(tr, stocks ? perSite(r => r.loose) : item.loose);
          makeCell(tr, item.caseSize);
          makeCell(tr, stocks ? perSite(r => Inventory.totalUnits(r)) : Inventory.totalUnits(item));
          makeCell(tr, stocks ? perSite(r => r.minCases ?? "Review") : Inventory.needsReview(item) ? "Set minimum" : item.minCases);
          makeCell(tr, stocks ? perSite(r => Inventory.casesToOrder(r) ?? "—") : Inventory.needsReview(item) ? "—" : Inventory.casesToOrder(item));
          const status = makeCell(tr, "");
          const badge = document.createElement("span");
          const review = stocks ? stocks.some(Inventory.needsReview) : Inventory.needsReview(item);
          const low = stocks ? stocks.some(Inventory.isLow) : Inventory.isLow(item);
          badge.className = "status-badge " + (review ? "review" : low ? "low" : "good");
          badge.textContent = review ? "Review Minimum" : low ? "Low at one or more sites" : "In Stock";
          status.appendChild(badge);
          const actions = makeCell(tr, "");
          actions.className = "table-actions";
          actions.append(button("Edit", "edit", item.id), button("Delete", "delete", item.id));
          table.appendChild(tr);
        }
        $("inventoryEmpty").classList.toggle("hidden", displayRows.length > 0);
        $("filterSummary").textContent = `Showing ${displayRows.length} product rows for ${facility()} (${rows.length} facility stock records).`;
      }
    
      function syncBothFields() {
        const both = $("itemFacility").value === "Both";
        $("bothStockFields").classList.toggle("hidden", !both);
        for (const key of ["Cases", "Loose", "Minimum"]) {
          const input = $(key === "Minimum" ? "itemMinimum" : `item${key}`);
          input.required = !both;
          input.disabled = both;
        }
        for (const location of ["Jamaica", "Flatlands"]) {
          for (const key of ["Cases", "Loose", "Min"]) {
            const input = $(`both${location}${key}`);
            input.required = both;
            input.disabled = !both;
          }
        }
      }
      function fillSharedFields(item) {
        const all = Inventory.all();
        const siblings = item?.sharedProductId
          ? all.filter(row => row.sharedProductId === item.sharedProductId)
          : item ? all.filter(row =>
            row.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
            row.vendor === item.vendor &&
            row.sku.trim().toLowerCase() === item.sku.trim().toLowerCase()
          ) : [];
        for (const location of ["Jamaica", "Flatlands"]) {
          const match = siblings.find(row => row.facility === location) ||
            (item?.facility === location ? item : null);
          $(`both${location}Cases`).value = match?.cases ?? 0;
          $(`both${location}Loose`).value = match?.loose ?? 0;
          $(`both${location}Min`).value = match?.minCases ?? 0;
        }
      }
    
      function openDialog(item = null) {
        $("itemForm").reset();
        $("formError").textContent = "";
        $("legacyNote").classList.add("hidden");
        $("editItemId").value = item ? item.id : "";
        $("dialogTitle").textContent = item ? "Edit Inventory Item" : "Add Inventory Item";
        $("itemFacility").value = facility() === "Flatlands" ? "Flatlands" : facility() === "Both" ? "Both" : "Jamaica";
        fillSharedFields(null);
        $("itemCases").value = 0;
        $("itemLoose").value = 0;
        $("itemCaseSize").value = 12;
        $("itemMinimum").value = "";
        if (item) {
          $("itemName").value = item.name;
          $("itemVendor").value = Array.from($("itemVendor").options).some(o => o.value === item.vendor) ? item.vendor : "Other";
          $("itemFacility").value = item.sharedProductId ? "Both" : item.facility;
          fillSharedFields(item);
          $("itemSku").value = item.sku;
          $("itemCases").value = item.cases;
          $("itemLoose").value = item.loose;
          $("itemCaseSize").value = item.caseSize;
          $("itemMinimum").value = item.minCases === null ? "" : item.minCases;
          if (Inventory.needsReview(item)) {
            $("legacyNote").textContent = item.legacyMinUnits === null
              ? "This older item needs a confirmed minimum in cases."
              : `Old minimum: ${item.legacyMinUnits} UNITS. Enter its correct minimum in CASES; the value was not automatically converted.`;
            $("legacyNote").classList.remove("hidden");
          }
        }
        syncBothFields();
        $("itemDialog").showModal();
        $("itemName").focus();
      }
      function saveItem(event) {
        event.preventDefault();
        $("formError").textContent = "";
        try {
          const name = $("itemName").value.trim();
          if (!name) throw new Error("Product name is required.");
          const common = {
            id: $("editItemId").value || undefined,
            name,
            vendor: $("itemVendor").value,
            sku: $("itemSku").value.trim(),
            caseSize: numberFromInput($("itemCaseSize").value, "Units per case", 1)
          };
          if ($("itemFacility").value === "Both") {
            const stocks = {};
            for (const location of ["Jamaica", "Flatlands"]) {
              stocks[location] = {
                cases: numberFromInput($(`both${location}Cases`).value, `${location} full cases`),
                loose: numberFromInput($(`both${location}Loose`).value, `${location} loose units`),
                minCases: numberFromInput($(`both${location}Min`).value, `${location} minimum cases`)
              };
            }
            Inventory.upsertShared(common, stocks);
          } else {
            const existing = common.id ? Inventory.find(common.id) : null;
            if (existing?.sharedProductId) {
              throw new Error("This product belongs to both facilities. Keep Both Facilities selected to edit both sets of stock.");
            }
            Inventory.upsert({
              ...common, facility: $("itemFacility").value,
              cases: numberFromInput($("itemCases").value, "Full cases"),
              loose: numberFromInput($("itemLoose").value, "Loose units"),
              minCases: numberFromInput($("itemMinimum").value, "Minimum cases")
            });
          }
          $("itemDialog").close();
          render();
        } catch (error) {
          $("formError").textContent = error.message;
          showStorageWarning();
        }
      }
    
      // A check-in starts from the current facility's complete product list.
      function initCheckinDraft() {
        const selection = $("checkinFacility").value;
        checkinDraft = Inventory.getVisible(selection)
          .sort((a,b) => a.name.localeCompare(b.name))
          .map(item => ({
            id: item.id, name: item.name, vendor: item.vendor,
            previousCases: item.cases, previousLoose: item.loose,
            cases: String(item.cases), loose: String(item.loose), confirmed: false
          }));
        draftChanged = false;
        $("checkinError").textContent = "";
        $("checkinSuccess").classList.add("hidden");
        renderCheckin();
      }
      function updateProgress() {
        const verified = checkinDraft.filter(row => row.confirmed).length;
        $("checkinProgress").textContent = `${verified} of ${checkinDraft.length} confirmed`;
        $("submitCheckinBtn").disabled = checkinDraft.length === 0;
      }
      function renderCheckin() {
        const tbody = $("checkinTable");
        tbody.replaceChildren();
        $("checkinCurrentDate").textContent = new Date().toLocaleDateString();
        for (const record of checkinDraft) {
          const tr = document.createElement("tr");
          if (record.confirmed) tr.classList.add("confirmed-row");
          makeCell(tr, record.name, "product-name");
          makeCell(tr, record.vendor, record.vendor === "Fresenius" ? "fresenius-text" : record.vendor === "Henry Schein" ? "henry-text" : "");
          makeCell(tr, `${record.previousCases} cases + ${record.previousLoose} loose`);
          for (const field of ["cases", "loose"]) {
            const cell = makeCell(tr, "");
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "1";
            input.required = true;
            input.className = "count-input";
            input.value = record[field];
            input.dataset.id = record.id;
            input.dataset.field = field;
            input.setAttribute("aria-label", `${record.name} counted ${field}`);
            cell.appendChild(input);
          }
          const checkboxCell = makeCell(tr, "");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = record.confirmed;
          checkbox.dataset.id = record.id;
          checkbox.dataset.field = "confirmed";
          checkbox.setAttribute("aria-label", `Confirmed physical count for ${record.name}`);
          checkboxCell.appendChild(checkbox);
          tbody.appendChild(tr);
        }
        $("checkinEmpty").classList.toggle("hidden", checkinDraft.length > 0);
        updateProgress();
        renderHistory();
      }
      function handleDraftInput(event) {
        const field = event.target.dataset.field;
        const id = event.target.dataset.id;
        const row = checkinDraft.find(item => item.id === id);
        if (!row || !["cases", "loose", "confirmed"].includes(field)) return;
        if (field === "confirmed") {
          row.confirmed = event.target.checked;
          event.target.closest("tr").classList.toggle("confirmed-row", row.confirmed);
          updateProgress();
        } else {
          row[field] = event.target.value;
          // Editing a previously verified value requires reconfirmation.
          if (row.confirmed) {
            row.confirmed = false;
            const checkbox = event.target.closest("tr").querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
            event.target.closest("tr").classList.remove("confirmed-row");
            updateProgress();
          }
        }
        draftChanged = true;
        $("checkinSuccess").classList.add("hidden");
      }
      function submitCheckin(event) {
        event.preventDefault();
        $("checkinError").textContent = "";
        try {
          if (!checkinDraft.length) throw new Error("Add inventory items to this facility first.");
          const entries = checkinDraft.map(row => ({
            id: row.id,
            cases: numberFromInput(row.cases, `${row.name}: cases`),
            loose: numberFromInput(row.loose, `${row.name}: loose units`),
            confirmed: row.confirmed
          }));
          if (entries.some(item => !item.confirmed)) {
            throw new Error("You must check Confirmed for every product before saving.");
          }
          const saved = Inventory.applyCheckin($("checkinFacility").value, entries);
          initCheckinDraft();
          $("checkinSuccess").textContent = `Saved ${saved.entries.length} counts for ${saved.facility} at ${new Date(saved.completedAt).toLocaleString()}. Inventory and low-stock alerts were updated.`;
          $("checkinSuccess").classList.remove("hidden");
          renderDashboard();
          showStorageWarning();
        } catch (error) {
          $("checkinError").textContent = error.message;
          showStorageWarning();
        }
      }
      function renderHistory() {
        const history = Inventory.history($("checkinFacility").value).slice(0, 10);
        const parent = $("checkinHistory");
        parent.replaceChildren();
        if (!history.length) {
          const p = document.createElement("p");
          p.className = "muted";
          p.textContent = "No saved check-ins for this facility yet.";
          parent.appendChild(p);
          return;
        }
        for (const record of history) {
          const details = document.createElement("details");
          details.className = "history-record";
          const summary = document.createElement("summary");
          summary.textContent = `${new Date(record.completedAt).toLocaleString()} · ${record.entries.length} items · ${record.lowCount} low-stock`;
          details.appendChild(summary);
          const wrap = document.createElement("div");
          wrap.className = "table-wrap";
          const table = document.createElement("table");
          table.className = "history-table";
          const header = document.createElement("thead");
          const headerRow = document.createElement("tr");
          for (const label of ["Product", "Previous", "Counted", "Units", "Status"]) {
            const th = document.createElement("th");
            th.textContent = label;
            headerRow.appendChild(th);
          }
          header.appendChild(headerRow);
          table.appendChild(header);
          const body = document.createElement("tbody");
          for (const item of record.entries) {
            const tr = document.createElement("tr");
            makeCell(tr, item.name);
            makeCell(tr, `${item.previousCases} cases + ${item.previousLoose} loose`);
            makeCell(tr, `${item.cases} cases + ${item.loose} loose`);
            makeCell(tr, item.totalUnits);
            makeCell(tr, item.minCases === null ? "Review minimum" : item.lowStock ? "Low Stock" : "In Stock");
            body.appendChild(tr);
          }
          table.appendChild(body);
          wrap.appendChild(table);
          details.appendChild(wrap);
          parent.appendChild(details);
        }
      }
      function render() {
        renderDashboard();
        if (currentPage === "inventory") renderInventory();
        if (currentPage === "checkin") renderHistory();
        showStorageWarning();
      }
    
      // Main navigation and dashboard shortcut buttons.
      document.addEventListener("click", event => {
        const nav = event.target.closest("[data-page]");
        if (nav) showPage(nav.dataset.page);
        const shortcut = event.target.closest("[data-goto]");
        if (shortcut) showPage(shortcut.dataset.goto);
      });
      $("lowStockCard").addEventListener("click", () => openInventoryFilter("low"));
      $("reviewCard").addEventListener("click", () => openInventoryFilter("review"));
      $("facilitySelect").addEventListener("change", render);
      $("inventorySearch").addEventListener("input", renderInventory);
      $("vendorFilter").addEventListener("change", renderInventory);
      $("stockFilter").addEventListener("change", renderInventory);
      $("clearFiltersBtn").addEventListener("click", () => openInventoryFilter("all"));
      $("addItemBtn").addEventListener("click", () => openDialog());
      $("closeDialogBtn").addEventListener("click", () => $("itemDialog").close());
      $("cancelDialogBtn").addEventListener("click", () => $("itemDialog").close());
      $("itemForm").addEventListener("submit", saveItem);
      $("itemFacility").addEventListener("change", syncBothFields);
      $("inventoryTable").addEventListener("click", event => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        const item = Inventory.find(btn.dataset.id);
        if (!item) return;
        if (btn.dataset.action === "edit") openDialog(item);
        if (btn.dataset.action === "delete" && confirm(`Delete ${item.name} from ${item.facility}?`)) {
          try { Inventory.remove(item.id); render(); }
          catch (error) { alert(error.message); showStorageWarning(); }
        }
      });
    
      $("checkinFacility").addEventListener("change", event => {
        const selection = event.target.value;
        if (draftChanged && !confirm("Switch facilities and discard unsaved counts?")) {
          event.target.value = selection === "Jamaica" ? "Flatlands" : "Jamaica";
          return;
        }
        initCheckinDraft();
      });
      $("checkinTable").addEventListener("input", event => {
        if (event.target.dataset.field !== "confirmed") handleDraftInput(event);
      });
      $("checkinTable").addEventListener("change", event => {
        if (event.target.dataset.field === "confirmed") handleDraftInput(event);
      });
      $("checkinForm").addEventListener("submit", submitCheckin);
      $("resetCheckinBtn").addEventListener("click", () => {
        if (!draftChanged || confirm("Discard unsaved counts and reload current inventory?")) initCheckinDraft();
      });
    
      render();
    });
    
