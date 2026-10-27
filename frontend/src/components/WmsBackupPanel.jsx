import { canEditWarehouse } from "../utils/browserSession";
import { useRef, useState } from 'react';
import { createBackup, validateBackup, restoreBackup, downloadJson, RECOVERY_KEY } from '../utils/wmsBackup';

export default function WmsBackupPanel() {
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const selection = useRef(0);
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  async function run(action) {
    try { await action(); } catch (error) { setNotice({ error: true, text: error.message }); }
  }
  async function selectFile(event) {
    const id = ++selection.current;
    const file = event.target.files?.[0];
    setPreview(null); setConfirmed(false); setNotice(null);
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Maximum backup size is 10 MB.');
      const backup = JSON.parse(await file.text());
      const summary = validateBackup(backup);
      if (selection.current === id) setPreview({ backup, summary, name: file.name });
    } catch (error) {
      if (selection.current === id) setNotice({ error: true, text: `File rejected: ${error.message}` });
    }
  }
  return <section className="panel overview-section">
    <h3>Backup &amp; Restore</h3>
    <p>Download warehouse data, inventory, operation history and saved preferences from this browser. Backend task records and RCS data are not included.</p>
    <div className="overview-actions">
      <button type="button" className="primary-button" onClick={() => run(() => {
        const backup = createBackup(); validateBackup(backup);
        downloadJson(backup, `wms-backup-${stamp()}.json`);
        setNotice({ text: 'Backup download requested. Keep the file in a safe location.' });
      })}>Download backup</button>
      <button type="button" className="settings-secondary" onClick={() => run(() => {
        const raw = localStorage.getItem(RECOVERY_KEY);
        if (!raw) throw new Error('No pre-restore recovery copy is available.');
        downloadJson(JSON.parse(raw), `wms-recovery-${stamp()}.json`);
        setNotice({ text: 'Recovery copy downloaded for manual recovery. It is not a normal import file.' });
      })}>Download pre-restore copy</button>
    </div>
    <div className="overview-form">
      <label>Choose a WMS backup (.json)<input type="file" accept=".json,application/json" onChange={selectFile} /></label>
    </div>
    {preview && <>
      <p><strong>{preview.name}</strong><br />Created: {new Date(preview.backup.createdAt).toLocaleString('en-GB')}</p>
      <dl className="overview-facts">{Object.entries(preview.summary).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
      <p>Restore replaces saved browser data. Close other WMS tabs first. This version requires an empty robot queue and robot history in both the browser and the backup; it will not replay robot tasks.</p>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I have closed other WMS tabs and want to replace this browser’s WMS data.</label>
      <div className="overview-actions"><button type="button" className="primary-button" disabled={!canEditWarehouse() || !confirmed} onClick={() => run(async () => {
        if (!window.confirm('Replace WMS browser data with this backup? A recovery copy will be saved first.')) return;
        await restoreBackup(preview.backup);
        window.location.reload();
      })}>Restore backup</button></div>
    </>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
  </section>;
}
