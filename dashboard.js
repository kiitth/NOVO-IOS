
/*
  NOVO IOS / Inventory Ordering System
  Black Edition Dashboard

  Features:
  - Live supply alerts
  - Recent daily check-ins
  - Facility-specific dashboard information
  - Time-of-day greeting
  - Export local data backup
  - Import local data backup

  This file does not change inventory
  calculations or existing storage formats.
*/

document.addEventListener("DOMContentLoaded", () => {
    "use strict";
  
    // ========================================
    // INITIAL SETUP
    // ========================================
  
    const $ = id => document.getElementById(id);
  
    if (
      typeof Inventory === "undefined" ||
      !$("priorityAlerts")
    ) {
      return;
    }
  
    // Browser storage keys used by NOVO IOS.
  
    const backupKeys = [
      "novo_ios_data_v3",
      "novo_ios_inventory_v2",
      "novo_ios_inventory_v1",
      "novo_ios_forecast_settings_v1",
      "novo_ios_orders_v1"
    ];
  
    // ========================================
    // ELEMENT HELPERS
    // ========================================
  
    function make(tag, className, text) {
      const element = document.createElement(tag);
  
      if (className) {
        element.className = className;
      }
  
      if (text !== undefined) {
        element.textContent = String(text);
      }
  
      return element;
    }
  
    function icon(name) {
      const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
  
      const use = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "use"
      );
  
      use.setAttribute("href", "#ic-" + name);
  
      svg.appendChild(use);
  
      return svg;
    }
  
    function emptyMessage(target, title, detail) {
      const box = make("div", "empty-friendly");
  
      box.append(
        make("strong", "", title),
        make("small", "", detail)
      );
  
      target.replaceChildren(box);
    }
  
    // ========================================
    // DASHBOARD OVERVIEW
    // ========================================
  
    function renderOverview() {
      const facility = $("facilitySelect").value;
  
      const facilityName =
        facility === "Both"
          ? "both facilities"
          : facility;
  
      $("dashboardFacilityName").textContent =
        facilityName;
  
      // ======================================
      // TIME OF DAY
      // ======================================
  
      const now = new Date();
  
      const hour = now.getHours();
  
      let greeting;
  
      if (hour < 12) {
        greeting = "morning";
      } else if (hour < 17) {
        greeting = "afternoon";
      } else {
        greeting = "evening";
      }
  
      $("dayGreeting").textContent = greeting;
  
      $("dashboardDate").textContent =
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        });
  
      // ======================================
      // GET INVENTORY
      // ======================================
  
      const products = Inventory.getVisible(
        facility
      );
  
      // Find products below their minimums.
  
      const lowStock = products
        .filter(Inventory.isLow)
  
        .sort((a, b) => {
          const shortageA =
            Inventory.casesToOrder(a) || 0;
  
          const shortageB =
            Inventory.casesToOrder(b) || 0;
  
          return (
            shortageB - shortageA ||
            a.name.localeCompare(b.name)
          );
        });
  
      // ======================================
      // DISPLAY SUPPLY ALERTS
      // ======================================
  
      const alerts = $("priorityAlerts");
  
      alerts.replaceChildren();
  
      if (lowStock.length === 0) {
        emptyMessage(
          alerts,
          "All set for now",
          "No items below their confirmed minimums."
        );
  
      } else {
        lowStock.slice(0, 4).forEach(item => {
          const row = make(
            "div",
            "alert-item"
          );
  
          const marker = make(
            "span",
            "alert-dot"
          );
  
          marker.appendChild(
            icon("alert")
          );
  
          const copy = make(
            "div",
            "alert-copy"
          );
  
          copy.append(
            make(
              "strong",
              "",
              item.name
            ),
  
            make(
              "small",
              "",
              item.facility + " · " + item.vendor
            )
          );
  
          const cases =
            Inventory.casesToOrder(item);
  
          const shortage = make(
            "span",
            "shortage-tag",
  
            `${cases} case${
              cases === 1 ? "" : "s"
            } short`
          );
  
          row.append(
            marker,
            copy,
            shortage
          );
  
          alerts.appendChild(row);
        });
      }
  
      // ======================================
      // RECENT DAILY CHECK-IN HISTORY
      // ======================================
  
      const history = [];
  
      if (
        typeof Inventory.history === "function"
      ) {
        for (
          const site of [
            "Jamaica",
            "Flatlands"
          ]
        ) {
          if (
            facility === "Both" ||
            facility === site
          ) {
            history.push(
              ...Inventory.history(site)
            );
          }
        }
      }
  
      // Newest records first.
  
      history.sort((a, b) =>
        String(b.completedAt).localeCompare(
          String(a.completedAt)
        )
      );
  
      const activity = $("recentCheckins");
  
      activity.replaceChildren();
  
      if (history.length === 0) {
        emptyMessage(
          activity,
          "No check-ins yet",
          "Your completed morning counts will appear here."
        );
  
      } else {
        history.slice(0, 3).forEach(record => {
          const row = make(
            "div",
            "activity-item"
          );
  
          const marker = make(
            "span",
            "activity-dot"
          );
  
          marker.appendChild(
            icon("clipboard")
          );
  
          const copy = make(
            "div",
            "activity-copy"
          );
  
          const date = new Date(
            record.completedAt
          );
  
          const time = Number.isNaN(
            date.getTime()
          )
            ? "Date unavailable"
  
            : date.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              });
  
          const count = Array.isArray(
            record.entries
          )
            ? record.entries.length
            : 0;
  
          copy.append(
            make(
              "strong",
              "",
              record.facility +
                " inventory check-in"
            ),
  
            make(
              "small",
              "",
              `${time} · ${count} products counted`
            )
          );
  
          row.append(
            marker,
            copy
          );
  
          activity.appendChild(row);
        });
      }
    }
  
    // ========================================
    // DASHBOARD EVENT LISTENERS
    // ========================================
  
    // Open low-stock inventory.
  
    $("viewAllAlertsBtn").addEventListener(
      "click",
      () => {
        $("lowStockCard").click();
      }
    );
  
    // Refresh information when the facility
    // selector changes.
  
    $("facilitySelect").addEventListener(
      "change",
      renderOverview
    );
  
    // Refresh dashboard after navigation.
  
    document.addEventListener(
      "click",
      event => {
        const navigation = event.target.closest(
          "[data-page], [data-goto], " +
          "#lowStockCard, #reviewCard"
        );
  
        if (
          navigation &&
          !$("dashboardPage").classList.contains(
            "hidden"
          )
        ) {
          renderOverview();
        }
      }
    );
  
    // ========================================
    // BACKUP SYSTEM
    // ========================================
  
    function tell(message, error = false) {
      const output = $("backupMessage");
  
      output.textContent = message;
  
      output.style.color = error
        ? "#ff92a0"
        : "#62d8ae";
    }
  
    // ========================================
    // EXPORT BACKUP
    // ========================================
  
    $("backupExportBtn").addEventListener(
      "click",
      () => {
        try {
          const data = {};
  
          // Collect existing localStorage data.
  
          for (const key of backupKeys) {
            const value =
              localStorage.getItem(key);
  
            if (value !== null) {
              // Verify that the stored value
              // contains readable JSON.
  
              JSON.parse(value);
  
              data[key] = value;
            }
          }
  
          if (
            Object.keys(data).length === 0
          ) {
            tell(
              "Nothing has been saved in this browser yet.",
              true
            );
  
            return;
          }
  
          const content = JSON.stringify(
            {
              format:
                "novo-ios-local-backup",
  
              version: 1,
  
              exportedAt:
                new Date().toISOString(),
  
              data
            },
            null,
            2
          );
  
          // Create a downloadable JSON file.
  
          const blob = new Blob(
            [content],
            {
              type: "application/json"
            }
          );
  
          const url =
            URL.createObjectURL(blob);
  
          const anchor = make("a");
  
          anchor.href = url;
  
          anchor.download =
            "novo-ios-backup-" +
            new Date()
              .toISOString()
              .slice(0, 10) +
            ".json";
  
          document.body.appendChild(anchor);
  
          anchor.click();
  
          anchor.remove();
  
          setTimeout(
            () => URL.revokeObjectURL(url),
            1000
          );
  
          tell(
            "Backup exported. Keep the file private and somewhere safe."
          );
  
        } catch (error) {
          tell(
            "Backup failed: " + error.message,
            true
          );
        }
      }
    );
  
    // ========================================
    // IMPORT BACKUP BUTTON
    // ========================================
  
    $("backupImportBtn").addEventListener(
      "click",
      () => {
        $("backupFileInput").click();
      }
    );
  
    // ========================================
    // IMPORT BACKUP FILE
    // ========================================
  
    $("backupFileInput").addEventListener(
      "change",
      async event => {
        const file = event.target.files?.[0];
  
        event.target.value = "";
  
        if (!file) {
          return;
        }
  
        try {
          // Maximum backup size: 4 MB.
  
          if (
            file.size > 4 * 1024 * 1024
          ) {
            throw new Error(
              "File is too large (4 MB limit)."
            );
          }
  
          const backup = JSON.parse(
            await file.text()
          );
  
          // Validate backup structure.
  
          if (
            backup.format !==
              "novo-ios-local-backup" ||
  
            backup.version !== 1 ||
  
            !backup.data ||
  
            typeof backup.data !== "object" ||
  
            Array.isArray(backup.data)
          ) {
            throw new Error(
              "This is not a valid NOVO IOS backup file."
            );
          }
  
          const keys = Object.keys(
            backup.data
          );
  
          if (
            keys.length === 0 ||
  
            keys.some(
              key => !backupKeys.includes(key)
            )
          ) {
            throw new Error(
              "Backup contains unsupported storage keys."
            );
          }
  
          // Validate records before importing.
  
          for (const key of keys) {
            if (
              typeof backup.data[key] !==
              "string"
            ) {
              throw new Error(
                "Invalid saved record."
              );
            }
  
            const decoded = JSON.parse(
              backup.data[key]
            );
  
            // Validate inventory version 3.
  
            if (
              key === "novo_ios_data_v3" &&
  
              (
                !decoded ||
  
                !Array.isArray(
                  decoded.items
                ) ||
  
                !Array.isArray(
                  decoded.checkins
                )
              )
            ) {
              throw new Error(
                "The inventory and check-in data is not valid."
              );
            }
  
            // Validate older inventory formats.
  
            if (
              key ===
                "novo_ios_inventory_v1" ||
  
              key ===
                "novo_ios_inventory_v2"
            ) {
              if (
                !Array.isArray(decoded) &&
  
                !Array.isArray(
                  decoded?.items
                ) &&
  
                !Array.isArray(
                  decoded?.inventory
                )
              ) {
                throw new Error(
                  "An older inventory record is not valid."
                );
              }
            }
  
            // Validate orders.
  
            if (
              key === "novo_ios_orders_v1" &&
  
              !Array.isArray(decoded)
            ) {
              throw new Error(
                "Order history data is not valid."
              );
            }
  
            // Validate forecasting settings.
  
            if (
              key ===
                "novo_ios_forecast_settings_v1" &&
  
              (
                !decoded ||
  
                typeof decoded !== "object"
              )
            ) {
              throw new Error(
                "Forecast settings are not valid."
              );
            }
          }
  
          // Ask for confirmation before
          // replacing existing browser data.
  
          const confirmed = confirm(
            "Import this NOVO IOS backup?\n\n" +
  
            "This will REPLACE saved inventory " +
            "and settings in this browser.\n\n" +
  
            "Export a backup of your current " +
            "data first."
          );
  
          if (!confirmed) {
            return;
          }
  
          // Capture old records for rollback.
  
          const previous = new Map(
            backupKeys.map(
              key => [
                key,
                localStorage.getItem(key)
              ]
            )
          );
  
          try {
            // Clear known storage records.
  
            backupKeys.forEach(
              key => {
                localStorage.removeItem(key);
              }
            );
  
            // Apply imported records.
  
            keys.forEach(
              key => {
                localStorage.setItem(
                  key,
                  backup.data[key]
                );
              }
            );
  
          } catch (error) {
            // Attempt to restore older records
            // if saving the backup fails.
  
            for (
              const [key, old] of previous
            ) {
              try {
                if (old === null) {
                  localStorage.removeItem(key);
  
                } else {
                  localStorage.setItem(
                    key,
                    old
                  );
                }
  
              } catch (rollbackError) {
                console.error(
                  "Backup restore rollback failed:",
                  rollbackError
                );
              }
            }
  
            throw error;
          }
  
          alert(
            "Backup imported. NOVO IOS will " +
            "reload to use the restored records."
          );
  
          location.reload();
  
        } catch (error) {
          tell(
            "Import failed: " + error.message,
            true
          );
        }
      }
    );
  
    // ========================================
    // INITIAL DASHBOARD RENDER
    // ========================================
  
    renderOverview();
  
  });
  
