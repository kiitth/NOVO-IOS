// NOVO IOS - WEEKLY UTILIZATION FORECASTING
// Add <script src="forecast.js" defer></script> after app.js in index.html.
// This feature is a local purchasing estimator, not a clinical decision system.

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "novo_ios_forecast_settings_v1";

  // Editable starting assumptions, not live RenVio or patient records.
  const defaults = {
    treatments: { Jamaica: 328, Flatlands: 472 },
    coverageWeeks: 1,
    rules: {}
  };

  const settings = {
    treatments: { ...defaults.treatments },
    coverageWeeks: defaults.coverageWeeks,
    rules: {}
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      for (const name of ["Jamaica", "Flatlands"]) {
        if (Number.isSafeInteger(saved.treatments?.[name]) && saved.treatments[name] >= 0) {
          settings.treatments[name] = saved.treatments[name];
        }
      }
      if ([1, 2, 3, 4].includes(saved.coverageWeeks)) {
        settings.coverageWeeks = saved.coverageWeeks;
      }
      if (saved.rules && typeof saved.rules === "object" && !Array.isArray(saved.rules)) {
        settings.rules = saved.rules;
      }
    }
  } catch (error) {
    console.warn("Forecast settings were not available:", error);
  }

  const host = $("placeholderPage");
  const oldPanel = host.querySelector(".panel");
  const view = document.createElement("section");
  view.id = "forecastView";
  view.className = "panel hidden";

  // Only static, authored markup is assigned through innerHTML.
  view.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>Weekly Utilization Forecasting</h2>
        <p class="muted">Estimate weekly supplies and whole cases to order from your current inventory.</p>
      </div>
    </div>

    <p class="warning">Planning estimates only. Confirm current treatment schedules, product-specific usage, lead times, minimums, and deliveries before ordering. No patient data is used.</p>

    <form id="forecastForm">
      <div class="forecast-controls">
        <label>Jamaica (NDJ) treatments per week
          <input id="forecastJamaica" type="number" min="0" step="1" required>
        </label>
        <label>Flatlands (NDF) treatments per week
          <input id="forecastFlatlands" type="number" min="0" step="1" required>
        </label>
        <label>Weeks to cover
          <select id="forecastWeeks">
            <option value="1">1 week</option>
            <option value="2">2 weeks</option>
            <option value="3">3 weeks</option>
            <option value="4">4 weeks</option>
          </select>
        </label>
      </div>

      <p class="muted forecast-explain">Usage rule: <strong>Per treatment</strong> multiplies your rate by the facility's weekly treatments. <strong>Units per week</strong> uses a product-specific weekly quantity. Saline and bibags start at an editable 1.3 units/treatment; bloodlines start at 1.0. All other products require you to enter their usage.</p>

      <div class="forecast-stats" aria-live="polite">
        <div><span>Products configured</span><strong id="forecastConfigured">0</strong></div>
        <div><span>Products to order</span><strong id="forecastOrdering">0</strong></div>
        <div><span>Need usage rates</span><strong id="forecastMissing">0</strong></div>
      </div>

      <div class="table-wrap">
        <table class="forecast-table">
          <thead><tr>
            <th>Product</th><th>Facility</th><th>Vendor</th><th>Available units</th>
            <th>Units / case</th><th>Usage rule</th><th>Usage value</th>
            <th>Weekly units</th><th>Target units</th><th>Cases to order</th>
          </tr></thead>
          <tbody id="forecastTable"></tbody>
        </table>
      </div>
      <p id="forecastEmpty" class="empty-state hidden">No inventory found for the selected facility. Add products in Inventory first.</p>
      <p id="forecastMessage" role="status" aria-live="polite"></p>
      <div class="forecast-actions">
        <button type="submit" class="primary-btn">Save Settings &amp; Calculate</button>
        <button type="button" id="forecastExport" class="secondary-btn">Export Order List (CSV)</button>
      </div>
    </form>

    <p class="muted small-note">The order target is the greater of forecast demand for the selected weeks or the item's confirmed minimum stock. The order quantity rounds up to whole cases, after subtracting current inventory including loose units. Unconfigured products are excluded from ordering recommendations.</p>
  `;
  host.appendChild(view);

  const style = document.createElement("style");
  style.textContent = `
    .forecast-controls {display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:12px;margin:18px 0;}
    .forecast-controls label {display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:650;}
    .forecast-controls input,.forecast-controls select {width:100%;}
    .forecast-explain {font-size:13px;margin:14px 0 18px;}
    .forecast-stats {display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0;}
    .forecast-stats>div {background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px;}
    .forecast-stats span {display:block;color:#64748b;font-size:12px;margin-bottom:6px;}
    .forecast-stats strong {font-size:28px;color:#19243a;}
    .forecast-table {min-width:1250px;}
    .forecast-rule {width:145px;padding:7px!important;font-size:12px!important;}
    .forecast-qty {width:95px;padding:7px!important;font-size:12px!important;}
    .forecast-subtle {font-size:11px;color:#64748b;display:block;margin-top:4px;}
    .forecast-order {font-weight:800;color:#b45309;}
    .forecast-actions {display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:18px;}
    .forecast-error {color:#b91c1c;font-weight:650;margin-top:10px;}
    .forecast-success {color:#166534;font-weight:650;margin-top:10px;}
    @media(max-width:750px){.forecast-controls,.forecast-stats{grid-template-columns:1fr;}}
  `;
  document.head.appendChild(style);

  const number = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

  function defaultRule(item) {
    const title = item.name.toLowerCase();
    if (/\bsaline\b/.test(title) || /\bbibags?\b|\bbi[ -]?bags?\b/.test(title)) {
      return { mode: "treatment", quantity: 1.3 };
    }
    if (/\bblood[ -]?lines?\b/.test(title)) {
      return { mode: "treatment", quantity: 1 };
    }
    return { mode: "weekly", quantity: null };
  }

  function ruleFor(item) {
    const previous = settings.rules[item.id];
    if (!previous || typeof previous !== "object") return defaultRule(item);
    const mode = previous.mode === "treatment" ? "treatment" : "weekly";
    const q = previous.quantity;
    const valid = typeof q === "number" && Number.isFinite(q) && q >= 0 && (mode === "treatment" || Number.isSafeInteger(q));
    return { mode, quantity: valid ? q : null };
  }

  function currentItems() {
    return Inventory.getVisible($("facilitySelect").value).sort((a, b) =>
      a.facility.localeCompare(b.facility) || a.name.localeCompare(b.name)
    );
  }

  function calculations(item, rule, inputs) {
    if (rule.quantity === null) return null;
    const weeklyTreatments = inputs.treatments[item.facility];
    const weeklyUnits = rule.mode === "treatment"
      ? Math.ceil(weeklyTreatments * rule.quantity - 1e-9)
      : rule.quantity;
    const minUnits = Inventory.minimumUnits(item);
    const demandUnits = Math.ceil(weeklyUnits * inputs.coverageWeeks);
    const targetUnits = Math.max(demandUnits, minUnits === null ? 0 : minUnits);
    const availableUnits = Inventory.totalUnits(item);
    const missingUnits = Math.max(0, targetUnits - availableUnits);
    return { weeklyUnits, targetUnits, cases: Math.ceil(missingUnits / item.caseSize) };
  }

  function cell(row, value, cssClass = "") {
    const td = document.createElement("td");
    td.textContent = String(value);
    if (cssClass) td.className = cssClass;
    row.appendChild(td);
    return td;
  }

  function displayMessage(message, error = false) {
    const node = $("forecastMessage");
    node.textContent = message;
    node.className = message ? (error ? "forecast-error" : "forecast-success") : "";
  }

  function validatedInputs() {
    const treatments = {};
    for (const place of ["Jamaica", "Flatlands"]) {
      const value = $("forecast" + place).value.trim();
      const n = Number(value);
      if (value === "" || !Number.isSafeInteger(n) || n < 0) {
        throw new Error(`${place} treatments must be a nonnegative whole number.`);
      }
      treatments[place] = n;
    }
    const weeks = Number($("forecastWeeks").value);
    if (![1, 2, 3, 4].includes(weeks)) throw new Error("Choose 1–4 weeks.");
    return { treatments, coverageWeeks: weeks };
  }

  function renderRows() {
    const tbody = $("forecastTable");
    tbody.replaceChildren();
    const inputs = { treatments: settings.treatments, coverageWeeks: settings.coverageWeeks };
    let configured = 0, ordering = 0, missing = 0;
    const items = currentItems();
    for (const item of items) {
      const rule = ruleFor(item);
      const result = calculations(item, rule, inputs);
      if (result === null) missing++;
      else {
        configured++;
        if (result.cases > 0) ordering++;
      }
      const tr = document.createElement("tr");
      const product = cell(tr, item.name, "product-name");
      if (Inventory.needsReview(item)) {
        const warning = document.createElement("small");
        warning.className = "forecast-subtle";
        warning.textContent = "Minimum not reviewed";
        product.appendChild(warning);
      }
      cell(tr, item.facility === "Jamaica" ? "NDJ" : "NDF");
      cell(tr, item.vendor);
      cell(tr, number(Inventory.totalUnits(item)));
      cell(tr, number(item.caseSize));

      const modeTd = cell(tr, "");
      const select = document.createElement("select");
      select.className = "forecast-rule";
      select.dataset.item = item.id;
      select.dataset.field = "mode";
      for (const [value, label] of [["treatment", "Per treatment"], ["weekly", "Units per week"]]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        select.appendChild(opt);
      }
      select.value = rule.mode;
      select.setAttribute("aria-label", `${item.name} usage rule`);
      modeTd.appendChild(select);

      const usageTd = cell(tr, "");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = rule.mode === "treatment" ? "0.01" : "1";
      input.className = "forecast-qty";
      input.dataset.item = item.id;
      input.dataset.field = "quantity";
      input.placeholder = "Set usage";
      input.value = rule.quantity === null ? "" : String(rule.quantity);
      input.setAttribute("aria-label", `${item.name} usage quantity`);
      usageTd.appendChild(input);

      cell(tr, result ? number(result.weeklyUnits) : "Set usage");
      cell(tr, result ? number(result.targetUnits) : "—");
      cell(tr, result ? number(result.cases) : "—", result && result.cases > 0 ? "forecast-order" : "");
      tbody.appendChild(tr);
    }
    $("forecastConfigured").textContent = configured;
    $("forecastOrdering").textContent = ordering;
    $("forecastMissing").textContent = missing;
    $("forecastEmpty").classList.toggle("hidden", items.length > 0);
  }

  function renderForecast() {
    $("forecastJamaica").value = settings.treatments.Jamaica;
    $("forecastFlatlands").value = settings.treatments.Flatlands;
    $("forecastWeeks").value = String(settings.coverageWeeks);
    renderRows();
    displayMessage("");
  }

  function syncPage() {
    const shown = $("pageTitle").textContent === "Forecasting" && !host.classList.contains("hidden");
    oldPanel.classList.toggle("hidden", shown);
    view.classList.toggle("hidden", !shown);
    if (shown) renderForecast();
  }

  // app.js processes these clicks first. Check its actual resulting page so
  // a rejected navigation away from an unsaved check-in is respected.
  document.addEventListener("click", event => {
    if (event.target.closest("[data-page], [data-goto]")) syncPage();
  });
  $("facilitySelect").addEventListener("change", () => {
    if (!view.classList.contains("hidden")) renderForecast();
  });

  $("forecastTable").addEventListener("change", event => {
    if (event.target.dataset.field !== "mode") return;
    const tr = event.target.closest("tr");
    const input = tr.querySelector('[data-field="quantity"]');
    input.value = "";
    input.step = event.target.value === "treatment" ? "0.01" : "1";
    displayMessage("Press Save Settings & Calculate to refresh the forecast.");
  });

  $("forecastForm").addEventListener("submit", event => {
    event.preventDefault();
    try {
      const inputs = validatedInputs();
      const nextRules = { ...settings.rules };
      for (const tr of $("forecastTable").rows) {
        const modeInput = tr.querySelector('[data-field="mode"]');
        const qtyInput = tr.querySelector('[data-field="quantity"]');
        if (!modeInput || !qtyInput) continue;
        const mode = modeInput.value;
        const raw = qtyInput.value.trim();
        const quantity = raw === "" ? null : Number(raw);
        if (raw !== "") {
          if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e9 ||
              (mode === "weekly" && !Number.isSafeInteger(quantity))) {
            const productName = tr.querySelector(".product-name")?.firstChild?.textContent || "Product";
            throw new Error(`${productName}: use a nonnegative ${mode === "weekly" ? "whole number of" : "number for"} units.`);
          }
        }
        nextRules[modeInput.dataset.item] = { mode, quantity };
      }
      const nextSettings = { ...inputs, rules: nextRules };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
      settings.treatments = { ...inputs.treatments };
      settings.coverageWeeks = inputs.coverageWeeks;
      settings.rules = nextRules;
      renderRows();
      displayMessage("Forecast settings saved. Order estimates updated from current inventory.");
    } catch (error) {
      displayMessage(error.message || "Unable to save forecast.", true);
    }
  });

  $("forecastExport").addEventListener("click", () => {
    try {
      // Export only persisted/configured calculations, not unsaved inputs.
      const inputs = { treatments: settings.treatments, coverageWeeks: settings.coverageWeeks };
      const csvRows = [["Facility", "Product", "Vendor", "Weekly units", "Current units", "Units per case", "Target units", "Cases to order"]];
      for (const item of currentItems()) {
        const result = calculations(item, ruleFor(item), inputs);
        if (!result || result.cases === 0) continue;
        csvRows.push([item.facility, item.name, item.vendor, result.weeklyUnits,
          Inventory.totalUnits(item), item.caseSize, result.targetUnits, result.cases]);
      }
      if (csvRows.length === 1) {
        displayMessage("No configured products currently need ordering.", true);
        return;
      }
      const escapeCsv = value => '"' + String(value).replaceAll('"', '""') + '"';
      const csv = csvRows.map(row => row.map(escapeCsv).join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "novo-ios-forecast-orders.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      displayMessage("Exported saved order recommendations. Verify quantities before placing orders.");
    } catch (error) {
      displayMessage(error.message || "Could not export the order list.", true);
    }
  });
});
