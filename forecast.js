
// ===========================================
// NOVO IOS - WEEKLY UTILIZATION FORECASTING
// Black Edition
// ===========================================
//
// Requires inventory.js and app.js.
//
// This is a purchasing estimator,
// not a clinical decision system.
//

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);

  const STORAGE_KEY =
    "novo_ios_forecast_settings_v1";

  // ---------------------------------------
  // DEFAULT FORECAST SETTINGS
  // ---------------------------------------

  const defaults = {
    treatments: {
      Jamaica: 328,
      Flatlands: 472
    },

    coverageWeeks: 1,

    rules: {}
  };

  const settings = {
    treatments: {
      ...defaults.treatments
    },

    coverageWeeks:
      defaults.coverageWeeks,

    rules: {}
  };

  // ---------------------------------------
  // LOAD SAVED SETTINGS
  // ---------------------------------------

  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ||
      "null"
    );

    if (
      saved &&
      typeof saved === "object"
    ) {
      for (const name of [
        "Jamaica",
        "Flatlands"
      ]) {
        if (
          Number.isSafeInteger(
            saved.treatments?.[name]
          ) &&
          saved.treatments[name] >= 0
        ) {
          settings.treatments[name] =
            saved.treatments[name];
        }
      }

      if (
        [1, 2, 3, 4].includes(
          saved.coverageWeeks
        )
      ) {
        settings.coverageWeeks =
          saved.coverageWeeks;
      }

      if (
        saved.rules &&
        typeof saved.rules === "object" &&
        !Array.isArray(saved.rules)
      ) {
        settings.rules = saved.rules;
      }
    }

  } catch (error) {
    console.warn(
      "Forecast settings were not available:",
      error
    );
  }

  // ---------------------------------------
  // CREATE FORECAST PAGE
  // ---------------------------------------

  const host = $("placeholderPage");

  if (
    !host ||
    typeof Inventory === "undefined"
  ) {
    console.error(
      "Forecast dependencies are missing."
    );

    return;
  }

  const oldPanel =
    host.querySelector(".panel");

  if (!oldPanel) {
    console.error(
      "Forecast placeholder panel is missing."
    );

    return;
  }

  const view =
    document.createElement("section");

  view.id = "forecastView";

  view.className = "panel hidden";

  view.innerHTML = `
    <div class="section-heading">
      <div>
        <div class="panel-kicker">
          SUPPLY PLANNING
        </div>

        <h2>
          Weekly Utilization Forecasting
        </h2>

        <p class="muted">
          Estimate weekly supply consumption
          and calculate cases to order.
        </p>
      </div>
    </div>

    <p class="warning">
      Planning estimates only.

      Confirm actual treatment schedules,
      product-specific usage, vendor lead
      times, minimum stock, and expected
      deliveries before placing orders.

      No patient-identifiable information
      is used.
    </p>

    <form id="forecastForm">

      <!-- TREATMENT SETTINGS -->

      <div class="forecast-controls">

        <label>
          Jamaica (NDJ) Treatments per Week

          <input
            id="forecastJamaica"
            type="number"
            min="0"
            step="1"
            required
          >
        </label>

        <label>
          Flatlands (NDF) Treatments per Week

          <input
            id="forecastFlatlands"
            type="number"
            min="0"
            step="1"
            required
          >
        </label>

        <label>
          Weeks to Cover

          <select id="forecastWeeks">
            <option value="1">1 Week</option>
            <option value="2">2 Weeks</option>
            <option value="3">3 Weeks</option>
            <option value="4">4 Weeks</option>
          </select>
        </label>

      </div>

      <!-- USAGE EXPLANATION -->

      <p class="muted forecast-explain">

        <strong>Usage Rules:</strong>

        Per Treatment multiplies a product's
        usage rate by the weekly treatment
        count of its facility.

        Units per Week uses a manually entered
        weekly quantity.

        Saline, bibags, and bloodlines start
        at an editable 1.3 units per treatment.

        All other products require their own
        usage rates.

      </p>

      <!-- FORECAST STATISTICS -->

      <div
        class="forecast-stats"
        aria-live="polite"
      >

        <div>
          <span>Products Configured</span>
          <strong id="forecastConfigured">0</strong>
        </div>

        <div>
          <span>Products to Order</span>
          <strong id="forecastOrdering">0</strong>
        </div>

        <div>
          <span>Need Usage Rates</span>
          <strong id="forecastMissing">0</strong>
        </div>

      </div>

      <!-- FORECAST TABLE -->

      <div class="table-wrap">

        <table class="forecast-table">

          <thead>
            <tr>
              <th>Product</th>
              <th>Facility</th>
              <th>Vendor</th>
              <th>Available Units</th>
              <th>Units / Case</th>
              <th>Usage Rule</th>
              <th>Usage Value</th>
              <th>Weekly Units</th>
              <th>Target Units</th>
              <th>Cases to Order</th>
            </tr>
          </thead>

          <tbody id="forecastTable"></tbody>

        </table>

      </div>

      <p
        id="forecastEmpty"
        class="empty-state hidden"
      >
        No inventory found for the selected
        facility.

        Add products in Inventory first.
      </p>

      <p
        id="forecastMessage"
        role="status"
        aria-live="polite"
      ></p>

      <!-- FORECAST ACTIONS -->

      <div class="forecast-actions">

        <button
          type="submit"
          class="primary-btn"
        >
          Save Settings &amp; Calculate
        </button>

        <button
          type="button"
          id="forecastExport"
          class="secondary-btn"
        >
          Export Order List (CSV)
        </button>

      </div>

    </form>

    <p class="muted small-note">

      The ordering target is the greater of
      projected demand for the selected
      period or the item's minimum stock.

      Available inventory is subtracted
      before rounding up to whole cases.

      Products without configured usage
      rates are excluded from ordering
      recommendations.

    </p>
  `;

  host.appendChild(view);

  // ---------------------------------------
  // FORECAST-SPECIFIC STYLING
  // ---------------------------------------

  const style =
    document.createElement("style");

  style.textContent = `
    .forecast-controls {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(160px, 1fr));
      gap: 12px;
      margin: 18px 0;
    }

    .forecast-controls label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      font-size: 13px;
      font-weight: 650;
    }

    .forecast-controls input,
    .forecast-controls select {
      width: 100%;
    }

    .forecast-explain {
      font-size: 13px;
      margin: 14px 0 18px;
    }

    .forecast-stats {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0;
    }

    .forecast-stats > div {
      background: #1b2637;
      border: 1px solid #34465d;
      border-radius: 10px;
      padding: 13px;
    }

    .forecast-stats span {
      display: block;
      color: #aebcd1;
      font-size: 12px;
      margin-bottom: 6px;
    }

    .forecast-stats strong {
      font-size: 28px;
      color: #ecf3ff;
    }

    .forecast-table {
      min-width: 1250px;
    }

    .forecast-rule {
      width: 145px;
      padding: 7px !important;
      font-size: 12px !important;
    }

    .forecast-qty {
      width: 95px;
      padding: 7px !important;
      font-size: 12px !important;
    }

    .forecast-subtle {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: #aebcd1;
    }

    .forecast-order {
      color: #ffc47e;
      font-weight: 800;
    }

    .forecast-actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .forecast-error {
      color: #ff9eaa;
      font-weight: 650;
      margin-top: 10px;
    }

    .forecast-success {
      color: #8be8b8;
      font-weight: 650;
      margin-top: 10px;
    }

    @media (max-width: 750px) {
      .forecast-controls,
      .forecast-stats {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);

  // ---------------------------------------
  // NUMBER FORMATTING
  // ---------------------------------------

  const number = n =>
    Number(n).toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 2
      }
    );

  // ---------------------------------------
  // DEFAULT PRODUCT USAGE
  // ---------------------------------------

  function defaultRule(item) {
    const title =
      item.name.toLowerCase();

    // Saline, bibags, and bloodlines
    // use 1.3 units per treatment.

    if (
      /\bsaline\b/.test(title) ||
      /\bbibags?\b|\bbi[ -]?bags?\b/.test(title) ||
      /\bblood[ -]?lines?\b/.test(title)
    ) {
      return {
        mode: "treatment",
        quantity: 1.3
      };
    }

    // Dialyzers and other products
    // require manually entered rates.

    return {
      mode: "weekly",
      quantity: null
    };
  }

  // ---------------------------------------
  // RETRIEVE SAVED USAGE RULE
  // ---------------------------------------

  function ruleFor(item) {
    const previous =
      settings.rules[item.id];

    if (
      !previous ||
      typeof previous !== "object"
    ) {
      return defaultRule(item);
    }

    const mode =
      previous.mode === "treatment"
        ? "treatment"
        : "weekly";

    const q = previous.quantity;

    const valid =
      typeof q === "number" &&
      Number.isFinite(q) &&
      q >= 0 &&
      (
        mode === "treatment" ||
        Number.isSafeInteger(q)
      );

    return {
      mode,
      quantity: valid ? q : null
    };
  }

  // ---------------------------------------
  // CURRENT INVENTORY PRODUCTS
  // ---------------------------------------

  function currentItems() {
    return Inventory
      .getVisible(
        $("facilitySelect").value
      )
      .sort((a, b) =>
        a.facility.localeCompare(
          b.facility
        ) ||
        a.name.localeCompare(
          b.name
        )
      );
  }

  // ---------------------------------------
  // FORECAST CALCULATIONS
  // ---------------------------------------

  function calculations(
    item,
    rule,
    inputs
  ) {
    if (rule.quantity === null) {
      return null;
    }

    const weeklyTreatments =
      inputs.treatments[
        item.facility
      ];

    let weeklyUnits;

    if (rule.mode === "treatment") {
      weeklyUnits = Math.ceil(
        weeklyTreatments *
        rule.quantity -
        1e-9
      );

    } else {
      weeklyUnits = rule.quantity;
    }

    const minUnits =
      Inventory.minimumUnits(item);

    const demandUnits = Math.ceil(
      weeklyUnits *
      inputs.coverageWeeks
    );

    const targetUnits = Math.max(
      demandUnits,
      minUnits === null
        ? 0
        : minUnits
    );

    const availableUnits =
      Inventory.totalUnits(item);

    const missingUnits = Math.max(
      0,
      targetUnits - availableUnits
    );

    const cases = Math.ceil(
      missingUnits / item.caseSize
    );

    return {
      weeklyUnits,
      targetUnits,
      cases
    };
  }

  // ---------------------------------------
  // TABLE CELL HELPER
  // ---------------------------------------

  function cell(
    row,
    value,
    cssClass = ""
  ) {
    const td =
      document.createElement("td");

    td.textContent = String(value);

    if (cssClass) {
      td.className = cssClass;
    }

    row.appendChild(td);

    return td;
  }

  // ---------------------------------------
  // STATUS MESSAGE
  // ---------------------------------------

  function displayMessage(
    message,
    error = false
  ) {
    const node =
      $("forecastMessage");

    node.textContent = message;

    node.className = message
      ? (
          error
            ? "forecast-error"
            : "forecast-success"
        )
      : "";
  }

  // ---------------------------------------
  // VALIDATE TREATMENT COUNTS
  // ---------------------------------------

  function validatedInputs() {
    const treatments = {};

    for (const place of [
      "Jamaica",
      "Flatlands"
    ]) {
      const value = $(
        "forecast" + place
      ).value.trim();

      const n = Number(value);

      if (
        value === "" ||
        !Number.isSafeInteger(n) ||
        n < 0
      ) {
        throw new Error(
          `${place} treatments must be ` +
          "a nonnegative whole number."
        );
      }

      treatments[place] = n;
    }

    const weeks = Number(
      $("forecastWeeks").value
    );

    if (
      ![1, 2, 3, 4].includes(weeks)
    ) {
      throw new Error(
        "Choose 1–4 weeks."
      );
    }

    return {
      treatments,
      coverageWeeks: weeks
    };
  }

  // ---------------------------------------
  // RENDER FORECAST TABLE
  // ---------------------------------------

  function renderRows() {
    const tbody =
      $("forecastTable");

    tbody.replaceChildren();

    const inputs = {
      treatments:
        settings.treatments,

      coverageWeeks:
        settings.coverageWeeks
    };

    let configured = 0;
    let ordering = 0;
    let missing = 0;

    const items = currentItems();

    for (const item of items) {
      const rule =
        ruleFor(item);

      const result =
        calculations(
          item,
          rule,
          inputs
        );

      if (result === null) {
        missing++;

      } else {
        configured++;

        if (result.cases > 0) {
          ordering++;
        }
      }

      const tr =
        document.createElement("tr");

      // Product name.

      const product = cell(
        tr,
        item.name,
        "product-name"
      );

      if (
        Inventory.needsReview(item)
      ) {
        const warning =
          document.createElement("small");

        warning.className =
          "forecast-subtle";

        warning.textContent =
          "Minimum not reviewed";

        product.appendChild(
          warning
        );
      }

      // Facility, vendor and stock.

      cell(
        tr,
        item.facility === "Jamaica"
          ? "NDJ"
          : "NDF"
      );

      cell(
        tr,
        item.vendor
      );

      cell(
        tr,
        number(
          Inventory.totalUnits(item)
        )
      );

      cell(
        tr,
        number(item.caseSize)
      );

      // USAGE RULE SELECTOR

      const modeTd =
        cell(tr, "");

      const select =
        document.createElement("select");

      select.className =
        "forecast-rule";

      select.dataset.item =
        item.id;

      select.dataset.field =
        "mode";

      for (
        const [value, label] of [
          [
            "treatment",
            "Per treatment"
          ],
          [
            "weekly",
            "Units per week"
          ]
        ]
      ) {
        const option =
          document.createElement("option");

        option.value = value;

        option.textContent = label;

        select.appendChild(option);
      }

      select.value = rule.mode;

      select.setAttribute(
        "aria-label",
        `${item.name} usage rule`
      );

      modeTd.appendChild(select);

      // USAGE QUANTITY INPUT

      const usageTd =
        cell(tr, "");

      const input =
        document.createElement("input");

      input.type = "number";

      input.min = "0";

      input.step =
        rule.mode === "treatment"
          ? "0.01"
          : "1";

      input.className =
        "forecast-qty";

      input.dataset.item =
        item.id;

      input.dataset.field =
        "quantity";

      input.placeholder =
        "Set usage";

      input.value =
        rule.quantity === null
          ? ""
          : String(rule.quantity);

      input.setAttribute(
        "aria-label",
        `${item.name} usage quantity`
      );

      usageTd.appendChild(input);

      // CALCULATED VALUES

      cell(
        tr,
        result
          ? number(result.weeklyUnits)
          : "Set usage"
      );

      cell(
        tr,
        result
          ? number(result.targetUnits)
          : "—"
      );

      cell(
        tr,
        result
          ? number(result.cases)
          : "—",

        result && result.cases > 0
          ? "forecast-order"
          : ""
      );

      tbody.appendChild(tr);
    }

    // Summary statistics.

    $("forecastConfigured").textContent =
      configured;

    $("forecastOrdering").textContent =
      ordering;

    $("forecastMissing").textContent =
      missing;

    $("forecastEmpty").classList.toggle(
      "hidden",
      items.length > 0
    );
  }

  // ---------------------------------------
  // RENDER ENTIRE FORECAST
  // ---------------------------------------

  function renderForecast() {
    $("forecastJamaica").value =
      settings.treatments.Jamaica;

    $("forecastFlatlands").value =
      settings.treatments.Flatlands;

    $("forecastWeeks").value =
      String(
        settings.coverageWeeks
      );

    renderRows();

    displayMessage("");
  }

  // ---------------------------------------
  // FORECAST NAVIGATION
  // ---------------------------------------

  function syncPage() {
    const shown =
      $("pageTitle").textContent ===
        "Forecasting" &&
      !host.classList.contains(
        "hidden"
      );

    oldPanel.classList.toggle(
      "hidden",
      shown
    );

    view.classList.toggle(
      "hidden",
      !shown
    );

    if (shown) {
      renderForecast();
    }
  }

  // The main app.js navigation runs first.

  document.addEventListener(
    "click",
    event => {
      if (
        event.target.closest(
          "[data-page], [data-goto]"
        )
      ) {
        syncPage();
      }
    }
  );

  $("facilitySelect").addEventListener(
    "change",
    () => {
      if (
        !view.classList.contains(
          "hidden"
        )
      ) {
        renderForecast();
      }
    }
  );

  // ---------------------------------------
  // CHANGE USAGE MODE
  // ---------------------------------------

  $("forecastTable").addEventListener(
    "change",
    event => {
      if (
        event.target.dataset.field !==
        "mode"
      ) {
        return;
      }

      const tr =
        event.target.closest("tr");

      const input =
        tr.querySelector(
          '[data-field="quantity"]'
        );

      // Require an updated usage value
      // when switching modes.

      input.value = "";

      input.step =
        event.target.value === "treatment"
          ? "0.01"
          : "1";

      displayMessage(
        "Press Save Settings & Calculate " +
        "to refresh the forecast."
      );
    }
  );

  // ---------------------------------------
  // SAVE SETTINGS AND CALCULATE
  // ---------------------------------------

  $("forecastForm").addEventListener(
    "submit",
    event => {
      event.preventDefault();

      try {
        const inputs =
          validatedInputs();

        const nextRules = {
          ...settings.rules
        };

        for (
          const tr of $("forecastTable").rows
        ) {
          const modeInput =
            tr.querySelector(
              '[data-field="mode"]'
            );

          const qtyInput =
            tr.querySelector(
              '[data-field="quantity"]'
            );

          if (
            !modeInput ||
            !qtyInput
          ) {
            continue;
          }

          const mode =
            modeInput.value;

          const raw =
            qtyInput.value.trim();

          const quantity =
            raw === ""
              ? null
              : Number(raw);

          if (raw !== "") {
            if (
              !Number.isFinite(quantity) ||
              quantity < 0 ||
              quantity > 1e9 ||
              (
                mode === "weekly" &&
                !Number.isSafeInteger(
                  quantity
                )
              )
            ) {
              const productName =
                tr.querySelector(
                  ".product-name"
                )?.firstChild?.textContent ||
                "Product";

              throw new Error(
                `${productName}: enter a valid ` +
                "nonnegative usage quantity."
              );
            }
          }

          nextRules[
            modeInput.dataset.item
          ] = {
            mode,
            quantity
          };
        }

        const nextSettings = {
          ...inputs,
          rules: nextRules
        };

        // Save settings to localStorage.

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            nextSettings
          )
        );

        settings.treatments = {
          ...inputs.treatments
        };

        settings.coverageWeeks =
          inputs.coverageWeeks;

        settings.rules =
          nextRules;

        renderRows();

        displayMessage(
          "Forecast settings saved. " +
          "Order estimates updated " +
          "from current inventory."
        );

      } catch (error) {
        displayMessage(
          error.message ||
          "Unable to save forecast.",
          true
        );
      }
    }
  );

  // ---------------------------------------
  // EXPORT ORDER RECOMMENDATIONS
  // ---------------------------------------

  $("forecastExport").addEventListener(
    "click",
    () => {
      try {
        const inputs = {
          treatments:
            settings.treatments,

          coverageWeeks:
            settings.coverageWeeks
        };

        const csvRows = [
          [
            "Facility",
            "Product",
            "Vendor",
            "Weekly units",
            "Current units",
            "Units per case",
            "Target units",
            "Cases to order"
          ]
        ];

        // Only include items with saved
        // usage rules and a shortage.

        for (
          const item of currentItems()
        ) {
          const result =
            calculations(
              item,
              ruleFor(item),
              inputs
            );

          if (
            !result ||
            result.cases === 0
          ) {
            continue;
          }

          csvRows.push([
            item.facility,
            item.name,
            item.vendor,
            result.weeklyUnits,
            Inventory.totalUnits(item),
            item.caseSize,
            result.targetUnits,
            result.cases
          ]);
        }

        if (
          csvRows.length === 1
        ) {
          displayMessage(
            "No configured products " +
            "currently need ordering.",
            true
          );

          return;
        }

        // Escape CSV values safely.

        const escapeCsv = value =>
          '"' +
          String(value).replaceAll(
            '"',
            '""'
          ) +
          '"';

        const csv = csvRows
          .map(row =>
            row
              .map(escapeCsv)
              .join(",")
          )
          .join("\r\n");

        const blob = new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8;"
          }
        );

        const url =
          URL.createObjectURL(blob);

        const link =
          document.createElement("a");

        link.href = url;

        link.download =
          "novo-ios-forecast-orders.csv";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(
          () => URL.revokeObjectURL(url),
          2000
        );

        displayMessage(
          "Order recommendations exported. " +
          "Verify all quantities before ordering."
        );

      } catch (error) {
        displayMessage(
          error.message ||
          "Could not export the order list.",
          true
        );
      }
    }
  );

});
