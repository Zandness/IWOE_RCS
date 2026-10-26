export const BACKUP_KEYS = [
  'wms-monitor-master-v2', 'wms-ui-preferences-v1', 'wms-robot-tasks-v1',
  'wms-transfer-input-history-v1', 'wms-inbound-orders-v1', 'wms-outbound-orders-v1',
  'wms-inventory-items-v1', 'wms-sku-masters-v1', 'wms-storage-locations-v1',
  'wms-warehouse-tasks-v1', 'wms-stock-outbound-history-v1',
];
export const RECOVERY_KEY = 'wms-before-restore-v1';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function requireValue(ok, text) { if (!ok) throw new Error(text); }
export function createBackup(storage = localStorage) {
  const data = Object.fromEntries(BACKUP_KEYS.map(key => [key, storage.getItem(key) === null ? null : JSON.parse(storage.getItem(key))]));
  return { format: 'IWOE-WMS-BACKUP', version: 1, createdAt: new Date().toISOString(), data };
}
export function validateBackup(backup) {
  requireValue(object(backup) && backup.format === 'IWOE-WMS-BACKUP' && backup.version === 1, 'Unsupported backup format or version.');
  requireValue(typeof backup.createdAt === 'string' && Number.isFinite(Date.parse(backup.createdAt)), 'Invalid backup date.');
  requireValue(object(backup.data), 'Missing backup data.');
  requireValue(Object.keys(backup.data).length === BACKUP_KEYS.length && BACKUP_KEYS.every(key => Object.hasOwn(backup.data, key)), 'Incomplete backup or unexpected data keys.');
  const monitor = backup.data[BACKUP_KEYS[0]];
  requireValue(object(monitor) && Array.isArray(monitor.racks) && Array.isArray(monitor.skuCatalog), 'Invalid warehouse data. Open Monitor before creating a backup.');
  const rackIds = new Set(), ids = new Set(), codes = new Map(), loads = new Set();
  let items = 0;
  for (const rack of monitor.racks) {
    requireValue(object(rack) && typeof rack.id === 'string' && rack.id && !rackIds.has(rack.id) && Array.isArray(rack.shelves), 'Invalid or duplicate storage ID.');
    rackIds.add(rack.id);
    requireValue(['BASKET','PALLET','RACK'].includes(rack.loadType || 'BASKET'), 'Invalid load type.');
    for (const shelf of rack.shelves) {
      requireValue(object(shelf) && typeof shelf.id === 'string' && shelf.id && !ids.has(shelf.id), 'Invalid or duplicate location ID.');
      ids.add(shelf.id);
      requireValue(typeof shelf.code === 'string', `Invalid location code at ${rack.id} / ${shelf.id}: expected text.`);
      // New levels/depths intentionally have no RCS code yet.
      const code = shelf.code.trim();
      if (code) {
        const position = `${rack.id} / ${shelf.id}`;
        requireValue(!codes.has(code), `Duplicate location code "${code}": ${codes.get(code)} and ${position}.`);
        codes.set(code, position);
      }
      requireValue(Array.isArray(shelf.inventory), 'Invalid inventory list.');
      if (shelf.basket != null) {
        requireValue(object(shelf.basket) && typeof shelf.basket.id === 'string' && shelf.basket.id && !loads.has(shelf.basket.id), 'Invalid or duplicate load ID.');
        loads.add(shelf.basket.id);
      }
      const itemIds = new Set();
      for (const item of shelf.inventory) {
        requireValue(object(item) && typeof item.id === 'string' && item.id && !itemIds.has(item.id) && typeof item.sku === 'string' && item.sku, 'Invalid inventory item.');
        itemIds.add(item.id);
        requireValue(typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity >= 0 && typeof (item.reserved ?? 0) === 'number' && Number.isFinite(item.reserved ?? 0) && (item.reserved ?? 0) >= 0 && (item.reserved ?? 0) <= item.quantity, 'Invalid stock or reserved quantity.');
        items++;
      }
    }
  }
  for (const name of ['history', 'outboundOperations', 'waypoints', 'waypointLinks', 'storageLinks']) {
    requireValue(monitor[name] == null || Array.isArray(monitor[name]), `Invalid ${name}.`);
  }
  const inputHistoryKey = 'wms-transfer-input-history-v1';
  for (const key of BACKUP_KEYS.slice(2)) {
    if (key === inputHistoryKey) continue;
    requireValue(backup.data[key] === null || (Array.isArray(backup.data[key]) && backup.data[key].every(object)), `Invalid list: ${key}.`);
  }
  const inputHistory = backup.data[inputHistoryKey];
  if (inputHistory !== null) {
    requireValue(object(inputHistory), 'Invalid transfer input history: expected an object.');
    for (const field of ['robots', 'types']) {
      requireValue(inputHistory[field] === undefined || (Array.isArray(inputHistory[field]) && inputHistory[field].every(value => typeof value === 'string')), `Invalid transfer input history: ${field} must be a list of text values.`);
    }
    for (const field of ['lastRobot', 'lastType']) {
      requireValue(inputHistory[field] === undefined || typeof inputHistory[field] === 'string', `Invalid transfer input history: ${field} must be text.`);
    }
  }
  const prefs = backup.data[BACKUP_KEYS[1]];
  requireValue(prefs === null || (object(prefs) && typeof prefs.warehouseName === 'string' && prefs.warehouseName.trim() && [30,60,90,120].includes(prefs.defaultPriority)), 'Invalid preferences.');
  return { racks: rackIds.size, locations: ids.size, loads: loads.size, items };
}
function requireNoQueue(data) {
  // This first restore version deliberately requires no robot records:
  // even completed records can trigger warehouse reconciliation on reload.
  const queue = data['wms-robot-tasks-v1'];
  requireValue(queue === null || (Array.isArray(queue) && queue.length === 0), 'Restore requires an empty robot queue/history in both the current browser and backup. Robot records cannot be safely replayed by this restore version.');
}
export function restoreBackup(backup, storage = localStorage) {
  validateBackup(backup);
  requireNoQueue(backup.data);
  const previous = Object.fromEntries(BACKUP_KEYS.map(key => [key, storage.getItem(key)]));
  requireNoQueue({ 'wms-robot-tasks-v1': JSON.parse(previous['wms-robot-tasks-v1'] || 'null') });
  // Save raw originals first, so even malformed old warehouse data can be recovered.
  storage.setItem(RECOVERY_KEY, JSON.stringify({ createdAt: new Date().toISOString(), raw: previous }));
  try {
    for (const key of BACKUP_KEYS) {
      if (backup.data[key] === null) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(backup.data[key]));
    }
  } catch (error) {
    try {
      for (const key of BACKUP_KEYS) {
        if (previous[key] === null) storage.removeItem(key);
        else storage.setItem(key, previous[key]);
      }
    } catch {
      throw new Error('Restore failed and rollback was incomplete. Download the recovery copy before making more changes.');
    }
    throw new Error(`Restore failed; original data restored. ${error.message}`);
  }
}
export function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
