// NOVO IOS - local inventory database and daily check-in history.
// Demo only: browser localStorage is not secure/shared storage.
const Inventory = (() => {
  const KEY_V3 = "novo_ios_data_v3";
  const KEY_V2 = "novo_ios_inventory_v2";
  const KEY_V1 = "novo_ios_inventory_v1";
  const MAX_HISTORY = 200;

  let items = [];
  let checkins = [];
  let storageAvailable = true;

  function wholeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
  }

  function optionalWholeNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    return wholeNumber(value, null);
  }

  function first(record, names) {
    for (const name of names) {
      if (record[name] !== undefined && record[name] !== null) return record[name];
    }
    return undefined;
  }

  function newId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `novo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function normalize(record) {
    if (!record || typeof record !== "object") return null;
    const caseSize = wholeNumber(first(record, ["caseSize", "unitsPerCase", "units_per_case", "case_size"]), 12) || 12;
    const minCases = optionalWholeNumber(first(record, ["minCases", "minimumCases", "minimum_cases"]));
    const legacyMinUnits = optionalWholeNumber(first(record, ["legacyMinUnits", "minimum", "minUnits", "minimumUnits", "minimumStock"]));
    return {
      id: String(record.id || newId()),
      name: String(first(record, ["name", "product", "productName"]) || "Unnamed Item"),
      vendor: String(record.vendor || "Other"),
      facility: record.facility === "Flatlands" ? "Flatlands" : "Jamaica",
      sku: String(first(record, ["sku", "itemNumber", "itemSku"]) || ""),
      cases: wholeNumber(first(record, ["cases", "fullCases", "caseCount"])),
      loose: wholeNumber(first(record, ["loose", "looseUnits", "units"])),
      caseSize,
      minCases,
      legacyMinUnits: minCases === null ? legacyMinUnits : null,
      createdAt: String(record.createdAt || new Date().toISOString()),
      updatedAt: String(record.updatedAt || new Date().toISOString())
    };
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return { found: raw !== null, value: raw === null ? null : JSON.parse(raw) };
    } catch (error) {
      storageAvailable = false;
      console.error(`Cannot read ${key}`, error);
      return { found: false, value: null, error: true };
    }
  }

  function extractItems(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.inventory)) return value.inventory;
    return null;
  }

  function load() {
    const latest = read(KEY_V3);
    if (latest.error) return;
    if (latest.found) {
      if (!latest.value || !Array.isArray(latest.value.items) || !Array.isArray(latest.value.checkins)) {
        storageAvailable = false;
        console.error("NOVO IOS version 3 data could not be read. Not overwriting existing data.");
        return;
      }
      items = latest.value.items.map(normalize).filter(Boolean);
      checkins = latest.value.checkins;
      return;
    }

    // Import earlier NOVO IOS inventory without deleting the older storage keys.
    const older = read(KEY_V2);
    if (older.error) return;
    const oldItems = older.found ? extractItems(older.value) : null;
    if (older.found && oldItems === null) {
      storageAvailable = false;
      console.error("Older inventory format is invalid. Not overwriting it.");
      return;
    }
    if (oldItems !== null) {
      items = oldItems.map(normalize).filter(Boolean);
      return;
    }
    const oldest = read(KEY_V1);
    if (oldest.error) return;
    const firstItems = oldest.found ? extractItems(oldest.value) : null;
    if (oldest.found && firstItems === null) {
      storageAvailable = false;
      console.error("Original inventory format is invalid. Not overwriting it.");
      return;
    }
    items = (firstItems || []).map(normalize).filter(Boolean);
  }

  // One write keeps inventory and a check-in snapshot together.
  function commit(nextItems, nextCheckins) {
    if (!storageAvailable) {
      throw new Error("Browser storage is unavailable. Inventory was not changed.");
    }
    try {
      localStorage.setItem(KEY_V3, JSON.stringify({
        schemaVersion: 3,
        items: nextItems,
        checkins: nextCheckins
      }));
      items = nextItems;
      checkins = nextCheckins;
    } catch (error) {
      storageAvailable = false;
      console.error("Saving NOVO IOS data failed", error);
      throw new Error("Could not save. Browser storage may be full or disabled.");
    }
  }

  function all() { return items.slice(); }
  function find(id) { return items.find(item => item.id === id) || null; }
  function getVisible(facility) {
    return items.filter(item => facility === "Both" || item.facility === facility);
  }
  function totalUnits(item) { return item.cases * item.caseSize + item.loose; }
  function minimumUnits(item) { return item.minCases === null ? null : item.minCases * item.caseSize; }
  function needsReview(item) { return item.minCases === null; }
  function isLow(item) {
    const min = minimumUnits(item);
    return min !== null && totalUnits(item) < min;
  }
  function shortageUnits(item) {
    const min = minimumUnits(item);
    return min === null ? null : Math.max(0, min - totalUnits(item));
  }
  function casesToOrder(item) {
    const shortage = shortageUnits(item);
    return shortage === null ? null : Math.ceil(shortage / item.caseSize);
  }

  function upsert(data) {
    const old = data.id ? find(String(data.id)) : null;
    const item = normalize({
      ...data,
      id: old ? old.id : newId(),
      createdAt: old ? old.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      legacyMinUnits: null
    });
    if (item.minCases === null) throw new Error("Enter a valid minimum in cases.");
    const next = items.slice();
    const position = next.findIndex(row => row.id === item.id);
    if (position < 0) next.push(item);
    else next[position] = item;
    commit(next, checkins);
    return item;
  }

  function remove(id) {
    commit(items.filter(item => item.id !== String(id)), checkins);
  }

  function history(facility) {
    return checkins
      .filter(record => record.facility === facility)
      .slice()
      .reverse();
  }

  function applyCheckin(facility, entries) {
    if (facility !== "Jamaica" && facility !== "Flatlands") {
      throw new Error("Choose Jamaica or Flatlands.");
    }
    const relevant = getVisible(facility);
    if (relevant.length === 0) throw new Error("Add inventory items before starting a check-in.");
    if (!Array.isArray(entries) || entries.length !== relevant.length) {
      throw new Error("Every product must be counted and confirmed.");
    }
    const countById = new Map();
    for (const entry of entries) {
      if (!entry || countById.has(entry.id)) throw new Error("Duplicate or missing product in the count.");
      const cases = Number(entry.cases);
      const loose = Number(entry.loose);
      if (!Number.isSafeInteger(cases) || cases < 0 || !Number.isSafeInteger(loose) || loose < 0) {
        throw new Error("Each count must be a nonnegative whole number.");
      }
      if (entry.confirmed !== true) throw new Error("Confirm each physical count before saving.");
      countById.set(entry.id, { cases, loose });
    }
    if (relevant.some(item => !countById.has(item.id))) {
      throw new Error("All products must be included in the check-in.");
    }

    const completedAt = new Date().toISOString();
    const snapshots = relevant.map(item => {
      const counted = countById.get(item.id);
      const revised = { ...item, ...counted };
      return {
        id: item.id,
        name: item.name,
        vendor: item.vendor,
        previousCases: item.cases,
        previousLoose: item.loose,
        cases: counted.cases,
        loose: counted.loose,
        caseSize: item.caseSize,
        totalUnits: totalUnits(revised),
        minCases: item.minCases,
        lowStock: isLow(revised)
      };
    });
    const record = {
      id: newId(),
      facility,
      completedAt,
      entries: snapshots,
      lowCount: snapshots.filter(row => row.lowStock).length
    };
    const nextItems = items.map(item => {
      if (item.facility !== facility) return item;
      return { ...item, ...countById.get(item.id), updatedAt: completedAt };
    });
    const nextCheckins = [...checkins, record].slice(-MAX_HISTORY);
    commit(nextItems, nextCheckins);
    return record;
  }

  load();
  return {
    all, find, getVisible, totalUnits, minimumUnits,
    needsReview, isLow, shortageUnits, casesToOrder,
    upsert, remove, history, applyCheckin,
    isStorageAvailable: () => storageAvailable
  };
})();
