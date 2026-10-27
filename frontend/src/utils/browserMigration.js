// Keep the current browser warehouse; never replace it with an older copy silently.
export function prepareBrowserWarehouse(storage = localStorage) {
  const key = 'wms-monitor-master-v2';
  const mode = storage.getItem('wms-storage-mode-v1');
  const current = storage.getItem(key);
  const previous = storage.getItem('wms-local-warehouse-v1');
  function warehouse(raw) {
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.racks) || !Array.isArray(value.skuCatalog)) throw new Error('Saved warehouse data is invalid. Preserve it and restore a valid backup before continuing.');
    return value;
  }
  if (current !== null) warehouse(current);
  const migrated = storage.getItem('wms-local-login-migration-v1') === '1';
  const fallback = !migrated && current === null && previous && previous !== 'null' ? previous : null;
  if (fallback) warehouse(fallback);
  if (mode !== null || fallback) {
    storage.setItem(`wms-before-browser-login-${Date.now()}-${crypto.randomUUID()}`, JSON.stringify({ createdAt: new Date().toISOString(), mode, warehouseRaw: current, previousWarehouseRaw: previous, queueRaw: storage.getItem('wms-robot-tasks-v1'), queueArchiveRaw: storage.getItem('wms-browser-transfer-history-v1') }));
    if (fallback) storage.setItem(key, fallback);
    storage.removeItem('wms-storage-mode-v1');
    storage.setItem('wms-local-login-migration-v1', '1');
  }
  return { recoveredPrevious: !!fallback };
}
