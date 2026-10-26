import { isStoppedTransferReviewed } from './basketStore.js';
import { validateDocuments } from './warehouseDocuments.js';
import { validateStockCounts } from './stockCount.js';

function state(status, label, nextStep, closed = false, attention = false) {
  return { status, label, nextStep, closed, attention, execution: 'RCS required' };
}
export function transferWorkflowState(task, monitor = {}, now = Date.now()) {
  if (!task || typeof task !== 'object') throw new Error('Invalid transfer queue record.');
  const key = task.rcsTaskChainCode || task.bridgeTaskId;
  if (task.rcsStatus === 'COMPLETED' && key && Object.hasOwn(monitor.completedBasketTransfers || {}, key)) {
    return state('COMPLETED', 'Completed in WMS', 'Transfer completion is recorded in the warehouse.', true);
  }
  if (isStoppedTransferReviewed(task, monitor)) {
    return state('STOPPED_REVIEWED', 'Stopped and reviewed', 'The stopped transfer was reviewed; no automatic retry.', true);
  }
  if (task.sendStatus === 'OUTCOME_UNKNOWN') {
    return state('OUTCOME_UNKNOWN', 'Outcome unknown', 'Check the existing task outcome before any resubmission.', false, true);
  }
  if (task.rcsStatus === 'COMPLETED') {
    return state('WMS_CONFIRMATION', 'Warehouse confirmation required', 'RCS reported completion, but WMS reconciliation is not recorded. Review the existing transfer.', false, true);
  }
  if (['FAILED', 'CANCELLED', 'CANCELED'].includes(task.rcsStatus)) {
    return state('STOPPED_REVIEW', 'Stopped; review required', 'Confirm the task outcome and physical Load location before releasing the transfer.', false, true);
  }
  if (task.backendError || task.statusCheckError || task.warehouseSyncError) {
    return state('NEEDS_ATTENTION', 'Review required', 'Review the saved error and existing task outcome before retrying.', false, true);
  }
  if (task.sendStatus === 'NOT_SENT') {
    if (task.scheduledSendAt && !Number.isFinite(Date.parse(task.scheduledSendAt))) return state('NEEDS_ATTENTION', 'Invalid schedule', 'Review the scheduled time before dispatch.', false, true);
    if (task.scheduledSendAt && Date.parse(task.scheduledSendAt) > now) return state('SCHEDULED', 'Not sent; scheduled', 'Waiting for the scheduled time and an enabled HIK dispatch workflow.');
    return state('NOT_SENT', 'Not sent', 'Waiting for dispatch. Physical movement requires a configured RCS connection.');
  }
  if (task.sendStatus === 'SENDING') return state('SUBMITTING', 'Submission unconfirmed', 'Wait for the current submission outcome; do not submit a duplicate task.');
  if (task.sendStatus === 'SENT' && ['CREATED', 'RUNNING'].includes(task.rcsStatus)) {
    return state('WAITING_RCS', `Last recorded: ${task.rcsStatus}`, 'Waiting for a confirmed task outcome. This is saved status, not a live connectivity check.');
  }
  return state('UNCONFIRMED', 'Status unconfirmed', 'Review the existing task status. A successful RCS connection has not been established here.', false, true);
}
const manualClosed = status => ['COMPLETED', 'CANCELLED', 'CANCELED'].includes(status);
export function buildWorkflowRows(monitor, queue, now = Date.now()) {
  if (!monitor) return [];
  validateDocuments(monitor.documents); validateStockCounts(monitor.stockCounts);
  if (!Array.isArray(queue) || (monitor.outboundOperations != null && !Array.isArray(monitor.outboundOperations))) throw new Error('Invalid workflow data.');
  const rows = (monitor.outboundOperations || []).map(operation => ({
    ...operation, kind: 'OUTBOUND', typeLabel: 'Outbound picking', source: operation.locationCode || operation.shelfId, destination: 'Picking workflow', path: '/operations', execution: 'WMS only', closed: manualClosed(operation.status), attention: !['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CANCELED'].includes(operation.status), label: String(operation.status || 'UNKNOWN').replaceAll('_', ' '), nextStep: manualClosed(operation.status) ? 'Review operation history.' : operation.status === 'IN_PROGRESS' ? 'Confirm physically picked quantities in Warehouse Operations.' : 'Start picking in Warehouse Operations. No RCS connection is required.',
  }));
  for (const doc of monitor.documents || []) rows.push({
    ...doc, sku: doc.lines.map(line => line.sku).join(', '), basketId: [...new Set(doc.lines.map(line => line.loadId))].join(', '), kind: 'DOCUMENT', typeLabel: `${doc.type === 'INBOUND' ? 'Inbound' : 'Outbound'} document`, execution: 'WMS only', source: doc.lines.map(line => line.locationCode || line.shelfId).join(', '), destination: doc.number, path: '/documents', closed: manualClosed(doc.status), attention: false, label: doc.status, nextStep: manualClosed(doc.status) ? 'Review document activity.' : doc.type === 'INBOUND' ? 'Confirm received quantities in Documents.' : 'Reserve stock, then confirm physically picked quantities in Documents.',
  });
  for (const count of monitor.stockCounts || []) rows.push({
    ...count, kind: 'STOCK_COUNT', typeLabel: 'Stock count', execution: 'WMS only', source: count.locationCode || count.shelfId, destination: 'Stock adjustment', basketId: count.loadId, path: '/stock-count', closed: manualClosed(count.status), attention: false, label: count.status === 'DRAFT' ? 'Draft count' : count.status, nextStep: count.status === 'DRAFT' ? 'Record physical counts and confirm the adjustment in Stock Count.' : 'Review the saved stock count.',
  });
  for (const task of queue) rows.push({ ...task, kind: 'BASKET_TRANSFER', typeLabel: 'Load transfer', source: task.sourceWmsLocationCode || task.sourceRcsPointCode || task.sourceLocationId, destination: task.destinationWmsLocationCode || task.destinationRcsPointCode || task.destinationLocationId, path: '/dispatcher', ...transferWorkflowState(task, monitor, now) });
  return rows;
}
