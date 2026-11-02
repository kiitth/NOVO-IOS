/*
  NOVO IOS / Inventory Ordering System
  Modern dashboard enhancements and optional local backup.
  This does not change your inventory calculations or storage format.
*/
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = id => document.getElementById(id);
  if (typeof Inventory === "undefined" || !$('priorityAlerts')) return;

  const backupKeys = [
    "novo_ios_data_v3",
    "novo_ios_inventory_v2",
    "novo_ios_inventory_v1",
    "novo_ios_forecast_settings_v1",
    "novo_ios_orders_v1"
  ];

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#ic-" + name);
    svg.appendChild(use);
    return svg;
  };

  function emptyMessage(target, title, detail) {
    const box = make("div", "empty-friendly");
    box.append(make("strong", "", title), make("small", "", detail));
    target.replaceChildren(box);
  }

  function renderOverview() {
    const facility = $('facilitySelect').value;
    const name = facility === 'Both' ? 'both facilities' : facility;
    $('dashboardFacilityName').textContent = name;

    const now = new Date();
    const hour = now.getHours();
    $('dayGreeting').textContent = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    $('dashboardDate').textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    const products = Inventory.getVisible(facility);
    const low = products.filter(Inventory.isLow).sort((a, b) => {
      const shortageA = Inventory.casesToOrder(a) || 0;
      const shortageB = Inventory.casesToOrder(b) || 0;
      return shortageB - shortageA || a.name.localeCompare(b.name);
    });

    const alerts = $('priorityAlerts');
    alerts.replaceChildren();
    if (!low.length) {
      emptyMessage(alerts, 'All set for now', 'No items below their confirmed minimums.');
    } else {
      low.slice(0, 4).forEach(item => {
        const row = make('div', 'alert-item');
        const mark = make('span', 'alert-dot');
        mark.appendChild(icon('alert'));
        const copy = make('div', 'alert-copy');
        copy.append(
          make('strong', '', item.name),
          make('small', '', item.facility + ' · ' + item.vendor)
        );
        const shortage = make('span', 'shortage-tag',
          `${Inventory.casesToOrder(item)} case${Inventory.casesToOrder(item) === 1 ? '' : 's'} short`
        );
        row.append(mark, copy, shortage);
        alerts.appendChild(row);
      });
    }

    const history = [];
    if (typeof Inventory.history === 'function') {
      for (const site of ['Jamaica', 'Flatlands']) {
        if (facility === 'Both' || facility === site) {
          history.push(...Inventory.history(site));
        }
      }
    }
    history.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    const activity = $('recentCheckins');
    activity.replaceChildren();
    if (!history.length) {
      emptyMessage(activity, 'No check-ins yet', 'Your completed morning counts will appear here.');
    } else {
      history.slice(0, 3).forEach(record => {
        const row = make('div', 'activity-item');
        const mark = make('span', 'activity-dot');
        mark.appendChild(icon('clipboard'));
        const copy = make('div', 'activity-copy');
        const date = new Date(record.completedAt);
        const time = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        const count = Array.isArray(record.entries) ? record.entries.length : 0;
        copy.append(make('strong', '', record.facility + ' inventory check-in'),
          make('small', '', `${time} · ${count} products counted`));
        row.append(mark, copy);
        activity.appendChild(row);
      });
    }
  }

  $('viewAllAlertsBtn').addEventListener('click', () => $('lowStockCard').click());
  $('facilitySelect').addEventListener('change', renderOverview);
  // app.js processes navigation first, so these updates see the current page state.
  document.addEventListener('click', event => {
    if (event.target.closest('[data-page], [data-goto], #lowStockCard, #reviewCard')) {
      if (!$('dashboardPage').classList.contains('hidden')) renderOverview();
    }
  });

  // BACKUP / RESTORE. Works only in this browser; no network calls.
  function tell(message, error = false) {
    const output = $('backupMessage');
    output.textContent = message;
    output.style.color = error ? '#ff92a0' : '#62d8ae';
  }

  $('backupExportBtn').addEventListener('click', () => {
    try {
      const data = {};
      for (const key of backupKeys) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          JSON.parse(value); // Prevent exporting unreadable JSON.
          data[key] = value;
        }
      }
      if (!Object.keys(data).length) {
        tell('Nothing has been saved in this browser yet.', true);
        return;
      }
      const content = JSON.stringify({
        format: 'novo-ios-local-backup', version: 1,
        exportedAt: new Date().toISOString(), data
      }, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = make('a');
      anchor.href = url;
      anchor.download = 'novo-ios-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      tell('Backup exported. Keep the file private and somewhere safe.');
    } catch (error) {
      tell('Backup failed: ' + error.message, true);
    }
  });

  $('backupImportBtn').addEventListener('click', () => $('backupFileInput').click());
  $('backupFileInput').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('File is too large (4 MB limit).');
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'novo-ios-local-backup' || backup.version !== 1 ||
          !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
        throw new Error('This is not a valid NOVO IOS backup file.');
      }
      const keys = Object.keys(backup.data);
      if (!keys.length || keys.some(key => !backupKeys.includes(key))) {
        throw new Error('Backup contains unsupported storage keys.');
      }
      for (const key of keys) {
        if (typeof backup.data[key] !== 'string') throw new Error('Invalid saved record.');
        const decoded = JSON.parse(backup.data[key]);
        if (key === 'novo_ios_data_v3' && (
          !decoded || !Array.isArray(decoded.items) || !Array.isArray(decoded.checkins))) {
          throw new Error('The inventory and check-in data is not valid.');
        }
        if ((key === 'novo_ios_inventory_v1' || key === 'novo_ios_inventory_v2') &&
            !Array.isArray(decoded) && !Array.isArray(decoded?.items) && !Array.isArray(decoded?.inventory)) {
          throw new Error('An older inventory record is not valid.');
        }
        if (key === 'novo_ios_orders_v1' && !Array.isArray(decoded)) {
          throw new Error('Order history data is not valid.');
        }
        if (key === 'novo_ios_forecast_settings_v1' && (!decoded || typeof decoded !== 'object')) {
          throw new Error('Forecast settings are not valid.');
        }
      }
      const yes = confirm('Import this NOVO IOS backup? It will REPLACE saved inventory and settings in this browser. Export a backup of your current data first.');
      if (!yes) return;
      const previous = new Map(backupKeys.map(key => [key, localStorage.getItem(key)]));
      try {
        backupKeys.forEach(key => localStorage.removeItem(key));
        keys.forEach(key => localStorage.setItem(key, backup.data[key]));
      } catch (error) {
        for (const [key, old] of previous) {
          try { if (old === null) localStorage.removeItem(key); else localStorage.setItem(key, old); }
          catch (rollbackError) { console.error('Backup restore rollback failed:', rollbackError); }
        }
        throw error;
      }
      alert('Backup imported. NOVO IOS will reload to use the restored records.');
      location.reload();
    } catch (error) {
      tell('Import failed: ' + error.message, true);
    }
  });

  renderOverview();
});
