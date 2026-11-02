
/*
 * NOVO IOS — Black Edition 2.0
 * Replayable Inventory Stock Animations
 *
 * Requires:
 *   inventory.js (Inventory API)
 *   index.html (#dashboardStockCharts and #inventoryStockCharts)
 *   stock-animations.css
 *
 * Stock percentage = current units / minimum units * 100.
 * The displayed number may exceed 100%; the gauge/bar stops at 100%.
 * A missing/zero minimum is NOT treated as 0% stock.
 */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);
  const dashboard = $("dashboardStockCharts");
  const inventory = $("inventoryStockCharts");
  const facilitySelect = $("facilitySelect");

  if (!dashboard || !inventory || !facilitySelect || typeof Inventory === "undefined") {
    return;
  }

  const DURATION = 1450; // milliseconds: quick start, smooth slowdown
  const STAGGER = 90;    // milliseconds between cards
  const DASHBOARD_LIMIT = 6;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

  let frameId = null;
  let activePage = null;
  let animationGeneration = 0;

  const format = n => Number(n).toLocaleString("en-US");

  function make(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== "") element.textContent = text;
    return element;
  }

  function currentPage() {
    if (!$("dashboardPage")?.classList.contains("hidden")) return "dashboard";
    if (!$("inventoryPage")?.classList.contains("hidden")) return "inventory";
    return null;
  }

  function stopAnimation() {
    animationGeneration++;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;

    document.querySelectorAll(".stock-chart-card.is-animating")
      .forEach(card => card.classList.remove("is-animating"));
  }

  function currentStockItems(page) {
    const site = facilitySelect.value;
    let rows = Inventory.getVisible(site).slice();

    // Match Inventory's filters while keeping facility stock separate.
    if (page === "inventory") {
      const term = ($("inventorySearch")?.value || "").trim().toLowerCase();
      const vendor = $("vendorFilter")?.value || "All";
      const status = $("stockFilter")?.value || "all";

      rows = rows.filter(item => {
        if (vendor !== "All" && item.vendor !== vendor) return false;

        if (
          term &&
          !`${item.name} ${item.sku || ""} ${item.vendor}`
            .toLowerCase()
            .includes(term)
        ) return false;

        if (status === "low" && !Inventory.isLow(item)) return false;
        if (status === "review" && !Inventory.needsReview(item)) return false;

        return true;
      });
    }

    // Prioritize shortages in the dashboard preview.
    rows.sort((a, b) => {
      const priority = item => {
        const min = Inventory.minimumUnits(item);
        if (min === null || min <= 0) return 1;

        const ratio = Inventory.totalUnits(item) / min;
        return ratio < 0.5 ? 0 : ratio < 1 ? 1 : 2;
      };

      return (
        priority(a) - priority(b) ||
        a.name.localeCompare(b.name) ||
        a.facility.localeCompare(b.facility)
      );
    });

    return page === "dashboard"
      ? rows.slice(0, DASHBOARD_LIMIT)
      : rows;
  }

  function stockDetails(item) {
    const onHand = Inventory.totalUnits(item);
    const minimum = Inventory.minimumUnits(item);

    const validMinimum =
      Number.isFinite(minimum) && minimum > 0;

    const percent = validMinimum
      ? Math.round((onHand / minimum) * 100)
      : null;

    let condition;
    let status;

    if (!validMinimum) {
      condition = "is-review";
      status = "Set minimum";
    } else if (percent < 50) {
      condition = "is-critical";
      status = "Critical stock";
    } else if (percent < 100) {
      condition = "is-low";
      status = "Below minimum";
    } else {
      condition = "is-healthy";
      status = "Minimum met";
    }

    return { onHand, minimum, percent, condition, status };
  }

  function makeCard(item, index) {
    const info = stockDetails(item);

    const card = make(
      "article",
      `stock-chart-card ${info.condition} is-entering`
    );

    card.style.setProperty("--fill-percent", "0%");
    card.style.setProperty(
      "--card-delay",
      `${Math.min(index, 8) * 55}ms`
    );

    // Product heading.
    const top = make("div", "stock-chart-top");
    const product = make("div");

    product.append(
      make("span", "stock-chart-category", item.vendor),
      make("h3", "stock-chart-title", item.name)
    );

    top.append(
      product,
      make(
        "span",
        "stock-chart-facility",
        item.facility === "Jamaica" ? "NDJ" : "NDF"
      )
    );

    // Animated percentage.
    const valueRow = make("div", "stock-chart-value-row");
    const valueBlock = make("div");
    const value = make("div", "stock-chart-value");

    const number = make(
      "span",
      "stock-meter-number",
      info.percent === null ? "—" : "0"
    );

    value.append(number);

    if (info.percent !== null) {
      value.append(
        make("span", "stock-meter-percent-sign", "%")
      );
    }

    valueBlock.append(
      value,
      make(
        "span",
        "stock-meter-kicker",
        "Current stock vs. minimum"
      )
    );

    // Circular gauge.
    const dial = make("div", "stock-meter-dial");
    dial.setAttribute("aria-hidden", "true");

    const dialCore = make("div", "stock-meter-dial-core");

    const dialValue = make(
      "strong",
      "stock-dial-number",
      info.percent === null ? "—" : "0%"
    );

    dialCore.append(
      dialValue,
      make("small", "", "STOCK")
    );

    dial.append(dialCore);
    valueRow.append(valueBlock, dial);

    // Horizontal progress bar.
    const meter = make("div", "stock-meter");
    const track = make("div", "stock-meter-track");

    track.setAttribute("role", "progressbar");
    track.setAttribute(
      "aria-label",
      `${item.name} at ${item.facility}: stock relative to minimum`
    );
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");

    if (info.percent === null) {
      track.setAttribute(
        "aria-valuetext",
        "Minimum stock not set"
      );
    } else {
      track.setAttribute(
        "aria-valuenow",
        String(Math.min(100, info.percent))
      );
      track.setAttribute(
        "aria-valuetext",
        `${format(info.percent)}% of minimum stock`
      );
    }

    track.append(make("div", "stock-meter-bar"));
    meter.append(track);

    // Actual inventory values.
    const meta = make("div", "stock-chart-meta");

    const current = make("span");
    current.append(
      make("strong", "", `${format(info.onHand)} units`),
      document.createTextNode(" on hand")
    );

    const target = make("span");
    target.append(
      make(
        "strong",
        "",
        info.minimum === null
          ? "Not set"
          : `${format(info.minimum)} units`
      ),
      document.createTextNode(" minimum")
    );

    meta.append(current, target);

    // Stock status.
    const footer = make("div", "stock-chart-foot");

    footer.append(
      make("span", "stock-chart-status", info.status),
      make(
        "span",
        "stock-chart-detail",
        `${format(item.cases)} cases + ${format(item.loose)} loose`
      )
    );

    card.append(top, valueRow, meter, meta, footer);

    return {
      card,
      number,
      dialValue,
      percent: info.percent
    };
  }

  // Update a single card during animation.
  function showValue(entry, value) {
    if (entry.percent === null) return;

    const rounded = Math.max(0, Math.round(value));

    entry.number.textContent = format(rounded);
    entry.dialValue.textContent = `${format(rounded)}%`;

    // The percentage number may exceed 100, but the
    // physical gauge is capped at 100% fill.
    entry.card.style.setProperty(
      "--fill-percent",
      `${Math.min(rounded, 100)}%`
    );
  }

  // Rebuild the cards and restart every counter from zero.
  function renderAndAnimate(page) {
    stopAnimation();
    activePage = page;

    if (!page) return;

    const target = page === "dashboard"
      ? dashboard
      : inventory;

    const items = currentStockItems(page);
    target.replaceChildren();

    if (!items.length) {
      target.append(
        make(
          "p",
          "stock-charts-empty",
          "No matching inventory items. Add products in Inventory to see stock charts."
        )
      );
      return;
    }

    const entries = items.map((item, index) =>
      makeCard(item, index)
    );

    const fragment = document.createDocumentFragment();

    entries.forEach(entry =>
      fragment.appendChild(entry.card)
    );

    target.appendChild(fragment);

    // Accessibility: show final values without animation
    // when the user has requested reduced motion.
    if (motionPreference.matches) {
      entries.forEach(entry =>
        showValue(entry, entry.percent)
      );

      entries.forEach(entry =>
        entry.card.classList.remove("is-entering")
      );

      return;
    }

    const generation = animationGeneration;
    let startTime = null;

    entries.forEach(entry => {
      if (entry.percent !== null) {
        entry.card.classList.add("is-animating");
      }
    });

    function tick(timestamp) {
      // Stop if the user left the page or started
      // a newer animation.
      if (
        generation !== animationGeneration ||
        activePage !== currentPage()
      ) return;

      if (startTime === null) startTime = timestamp;

      let allDone = true;

      entries.forEach((entry, index) => {
        if (entry.percent === null) return;

        const elapsed = Math.max(
          0,
          timestamp - startTime - index * STAGGER
        );

        const progress = Math.min(
          elapsed / DURATION,
          1
        );

        // Full-throttle effect:
        // quick acceleration followed by a soft finish.
        const eased = 1 - Math.pow(1 - progress, 4);

        showValue(
          entry,
          entry.percent * eased
        );

        if (progress < 1) {
          allDone = false;
        } else {
          entry.card.classList.remove("is-animating");
        }
      });

      if (!allDone) {
        frameId = requestAnimationFrame(tick);
      } else {
        frameId = null;

        entries.forEach(entry =>
          showValue(entry, entry.percent)
        );
      }
    }

    frameId = requestAnimationFrame(tick);
  }

  function syncPage(replay = false) {
    const page = currentPage();

    if (
      page !== activePage ||
      (replay && page)
    ) {
      renderAndAnimate(page);
    }
  }

  // Replay after navigating to Dashboard or Inventory.
  // app.js handles the navigation before this listener.
  document.addEventListener("click", event => {
    if (
      !event.target.closest(
        "[data-page], [data-goto]"
      )
    ) return;

    requestAnimationFrame(() => {
      syncPage(true);
    });
  });

  // Switching facilities also replays the animation
  // using the selected facility's inventory.
  facilitySelect.addEventListener("change", () => {
    requestAnimationFrame(() => {
      syncPage(true);
    });
  });

  // Keep charts synchronized with Inventory search
  // and stock-status filters.
  [
    "inventorySearch",
    "vendorFilter",
    "stockFilter"
  ].forEach(id => {
    const element = $(id);

    if (!element) return;

    element.addEventListener(
      id === "inventorySearch" ? "input" : "change",
      () => {
        if (currentPage() === "inventory") {
          renderAndAnimate("inventory");
        }
      }
    );
  });

  // Refresh when the Inventory add/edit dialog closes.
  $("itemDialog")?.addEventListener("close", () => {
    if (currentPage() === "inventory") {
      renderAndAnimate("inventory");
    }
  });

  // Replay when switching away from and back to
  // the browser tab.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      syncPage(true);
    }
  });

  // Replay if the browser restores the page from history.
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      syncPage(true);
    }
  });

  // Initial page load.
  renderAndAnimate(currentPage());
});
