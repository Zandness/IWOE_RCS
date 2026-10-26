// Read raw saved data: normalizers can conceal missing loads or invalid stock.
const MONITOR = 'wms-monitor-master-v2';
const QUEUE = 'wms-robot-tasks-v1';
const TASKS = 'wms-warehouse-tasks-v1';
const LOCATIONS = 'wms-storage-locations-v1';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => String(value ?? '').trim();

export function checkWmsConsistency(storage = localStorage) {
  const issues = [];
  const add = (type, message, position) => issues.push({ type, message, position });
  function read(key, fallback, valid) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      if (!valid(value)) throw new Error('Invalid data structure');
      return value;
    } catch {
      add('UNREADABLE_DATA', 'Saved data could not be read. This section could not be fully checked.', key);
      return fallback;
    }
  }
  const monitor = read(MONITOR, null, value => object(value) && Array.isArray(value.racks));
  if (monitor === null && !issues.some(issue => issue.position === MONITOR)) {
    add('MISSING_DATA', 'No warehouse data found. Open Monitor before checking.', MONITOR);
  }
  const codes = new Map(), loads = new Map(), locationIds = new Set();
  function remember(map, value, position) {
    if (!value) return;
    const positions = map.get(value) || [];
    positions.push(position);
    map.set(value, positions);
  }
  for (const [rackIndex, rack] of (monitor?.racks || []).entries()) {
    const rackPosition = `Monitor / ${text(rack?.id) || `storage #${rackIndex + 1}`}`;
    if (!object(rack) || !Array.isArray(rack.shelves)) {
      add('UNREADABLE_DATA', 'Location list could not be read.', rackPosition);
      continue;
    }
    for (const [index, shelf] of rack.shelves.entries()) {
      const position = `${rackPosition} / ${text(shelf?.code) || '(No Location Code)'} [${text(shelf?.id) || `#${index + 1}`}]`;
      if (!object(shelf)) {
        add('UNREADABLE_DATA', 'Location data could not be read.', position);
        continue;
      }
      if (text(shelf.id)) locationIds.add(text(shelf.id));
      remember(codes, text(shelf.code), position);
      remember(loads, text(shelf.basket?.id), position);
      if (!Array.isArray(shelf.inventory)) {
        add('UNREADABLE_DATA', 'Inventory list could not be read.', position);
        continue;
      }
      for (const [itemIndex, item] of shelf.inventory.entries()) {
        const itemPosition = `${position} / SKU ${text(item?.sku) || '?'} [${text(item?.id) || `#${itemIndex + 1}`}]`;
        if (!object(item) || !Number.isFinite(Number(item.quantity)) || !Number.isFinite(Number(item.reserved ?? 0))) {
          add('UNREADABLE_DATA', 'Stock or reserved quantity could not be read.', itemPosition);
          continue;
        }
        if (Number(item.reserved ?? 0) > Number(item.quantity)) {
          add('OVER_RESERVED', `Reserved quantity ${item.reserved} exceeds stock ${item.quantity}.`, itemPosition);
        }
        if (Number(item.quantity) > 0 && !text(shelf.basket?.id)) {
          add('STOCK_WITHOUT_LOAD', 'Stock exists without a Load ID.', itemPosition);
        }
      }
    }
  }
  for (const [map, type, label] of [[codes, 'DUPLICATE_LOCATION_CODE', 'Location Code'], [loads, 'DUPLICATE_LOAD_ID', 'Load ID']]) {
    for (const [value, positions] of map) {
      if (positions.length > 1) add(type, `Duplicate ${label}: ${value}`, positions.join(' ↔ '));
    }
  }
  function checkReference(id, known, position) {
    // Empty endpoints represent receiving/shipping in legacy tasks.
    if (text(id) && !known.has(text(id))) add('MISSING_TASK_LOCATION', `Task references a missing location: ${text(id)}`, position);
  }
  function checkTasks(tasks, known, source) {
    tasks.forEach((task, index) => {
      const position = `${source} / ${text(task?.id) || `#${index + 1}`}`;
      if (!object(task)) return add('UNREADABLE_DATA', 'Task data could not be read.', position);
      for (const field of ['sourceLocationId', 'destinationLocationId']) {
        checkReference(task[field], known, `${position} / ${field}`);
      }
    });
  }
  checkTasks(read(QUEUE, [], Array.isArray), locationIds, 'Transfer queue');
  const legacyLocations = read(LOCATIONS, [], Array.isArray);
  const legacyIds = new Set(legacyLocations.filter(object).map(location => text(location.id)).filter(Boolean));
  checkTasks(read(TASKS, [], Array.isArray), legacyIds, 'Warehouse tasks');
  if (monitor?.outboundOperations != null && !Array.isArray(monitor.outboundOperations)) {
    add('UNREADABLE_DATA', 'Outbound operation list could not be read.', 'Monitor / outboundOperations');
  }
  for (const [index, operation] of (Array.isArray(monitor?.outboundOperations) ? monitor.outboundOperations : []).entries()) {
    const position = `Outbound / ${text(operation?.id) || `#${index + 1}`}`;
    if (!object(operation)) {
      add('UNREADABLE_DATA', 'Task data could not be read.', position);
      continue;
    }
    if (text(operation.shelfId)) {
      const rack = monitor.racks.find(record => record?.id === operation.rackId);
      if (!Array.isArray(rack?.shelves) || !rack.shelves.some(shelf => shelf?.id === operation.shelfId)) {
        add('MISSING_TASK_LOCATION', `Task references a missing location: ${text(operation.rackId)} / ${text(operation.shelfId)}`, position);
      }
    }
  }
  if (monitor?.documents != null && !Array.isArray(monitor.documents)) {
    add('UNREADABLE_DATA', 'Warehouse documents could not be read.', 'Monitor / documents');
  }
  for (const [index, doc] of (Array.isArray(monitor?.documents) ? monitor.documents : []).entries()) {
    const position = `Document / ${text(doc?.number || doc?.id) || `#${index + 1}`}`;
    if (!object(doc) || !Array.isArray(doc.lines)) {
      add('UNREADABLE_DATA', 'Document lines could not be read.', position);
      continue;
    }
    // Closed documents keep historical locations even after layout changes.
    if (['COMPLETED', 'CANCELLED'].includes(doc.status)) continue;
    for (const [lineIndex, line] of doc.lines.entries()) {
      const rack = monitor.racks.find(record => record?.id === line?.rackId);
      if (!object(line) || !Array.isArray(rack?.shelves) || !rack.shelves.some(shelf => shelf?.id === line.shelfId)) {
        add('MISSING_TASK_LOCATION', `Document references a missing location: ${text(line?.rackId)} / ${text(line?.shelfId)}`, `${position} / Line ${lineIndex + 1}`);
      }
    }
  }
  return { issues, locationsChecked: locationIds.size, checkedAt: new Date().toISOString() };
}