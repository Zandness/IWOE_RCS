import { Link } from 'react-router-dom';
import { transferWorkflowState } from '../utils/workflowStatus';
import '../styles/WorkflowStatus.css';

export default function WorkflowStatusPanel({ monitor, queue = [] }) {
  const states = queue.map(task => transferWorkflowState(task, monitor || {}));
  const counts = [
    ['Not sent', states.filter(value => ['NOT_SENT', 'SCHEDULED'].includes(value.status)).length],
    ['Awaiting outcome', states.filter(value => ['SUBMITTING', 'WAITING_RCS'].includes(value.status)).length],
    ['Review required', states.filter(value => value.attention).length],
    ['Completed in WMS', states.filter(value => value.status === 'COMPLETED').length],
  ];
  return <section className="panel overview-section workflow-readiness">
    <h3>WMS work and RCS transfers</h3>
    <div className="overview-columns">
      <div><h4>WMS only</h4><p>Receive goods, reserve stock, confirm manual picking, count stock, review history, back up data and export reports without an RCS connection. Existing reservations, location restrictions and validation still apply.</p>
        <div className="overview-actions"><Link to="/documents">Documents</Link><Link to="/operations">Picking</Link><Link to="/stock-count">Stock Count</Link><Link to="/reports">Reports</Link><Link to="/settings">Backup / Restore</Link></div>
      </div>
      <div><h4>Physical Load transfers require RCS</h4><p>Creating a WMS queue record does not confirm robot movement. Submitted tasks need a confirmed outcome and warehouse reconciliation before the transfer is complete.</p>
        <p><strong>RCS connectivity: not checked here.</strong> This panel reads saved data only and does not connect, dispatch, retry or change task status.</p>
        <div className="overview-actions"><Link to="/tasks">Review task status</Link><Link to="/dispatcher">Open dispatch queue</Link></div>
      </div>
    </div>
    <dl className="workflow-readiness-counts">{counts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </section>;
}