import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useSaves } from '../hooks/useSaves';
import { useUserData } from '../contexts/UserDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { Panel } from '../components/common/Panel';
import { StardewDateInput } from '../components/common/StardewDateInput';
import { SaveFileUpload } from '../components/saves/SaveFileUpload';
import { SyncPanel, CreateRoomButton } from '../components/sync/SyncPanel';
import { encodeSave, decodeSave } from '../utils/saveCodec';
import type { FarmType, SaveFile, Skill } from '../types/save';
import type { Season } from '../types/game';

const FARM_TYPES: FarmType[] = [
  'standard', 'riverland', 'forest', 'hilltop',
  'wilderness', 'beach', 'four-corners', 'meadowlands',
];

const SKILLS: Skill[] = ['farming', 'mining', 'foraging', 'fishing', 'combat'];

const SEASON_LABELS: Record<Season, string> = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };

// ── Export panel ───────────────────────────────────────────────────────────────

function ExportPanel({ save, onClose }: { save: SaveFile; onClose: () => void }) {
  const code = useMemo(() => encodeSave(save), [save]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied]     = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    setQrFailed(false);
    const el = canvasRef.current;
    if (!el) return;
    QRCode.toCanvas(el, code, {
      width: 200,
      errorCorrectionLevel: 'L',
      margin: 1,
    }).catch(() => setQrFailed(true));
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g., non-HTTPS) — user can select manually
    }
  };

  return (
    <div className="save-export">
      <div className="save-export__header">
        <span className="save-export__title">Export — {save.name}</span>
        <button className="btn btn--sm" onClick={onClose}>✕ Close</button>
      </div>

      <p className="save-export__hint">
        Copy this code to back up your profile or transfer it to another device.
        Click the box to select all text.
      </p>

      <textarea
        className="save-export__code"
        value={code}
        readOnly
        rows={3}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        spellCheck={false}
        aria-label="Export code"
      />

      <div className="save-export__copy-row">
        <button
          className={`btn btn--sm${copied ? '' : ' btn--primary'}`}
          onClick={handleCopy}
        >
          {copied ? '✓ Copied!' : 'Copy to Clipboard'}
        </button>
        <span className="save-export__code-len">{code.length} chars</span>
      </div>

      {!qrFailed ? (
        <div className="save-export__qr">
          <canvas ref={canvasRef} />
          <span className="save-export__qr-hint">Scan to import on another device</span>
        </div>
      ) : (
        <p className="save-export__qr-too-large">
          Save is too large for a QR code — use Copy to Clipboard instead.
        </p>
      )}
    </div>
  );
}

// ── Import panel ───────────────────────────────────────────────────────────────

function ImportSection() {
  const { createSave } = useUserData();
  const [code, setCode]         = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);

  const handleImport = () => {
    setError(null);
    setImported(null);
    if (!code.trim()) { setError('Paste an export code first.'); return; }
    try {
      const save = decodeSave(code);
      createSave(save);
      setImported(save.name);
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import save.');
    }
  };

  return (
    <Panel title="Import Profile" className="save-import-panel">
      <p className="save-import__hint">
        Paste an export code below to restore or import a save profile.
      </p>
      <textarea
        className="save-import__code"
        value={code}
        onChange={(e) => { setCode(e.target.value); setError(null); setImported(null); }}
        placeholder="Paste export code here"
        rows={3}
        spellCheck={false}
        aria-label="Import code"
      />
      {error    && <p className="save-import__error">✗ {error}</p>}
      {imported && <p className="save-import__success">✓ Imported "{imported}"</p>}
      <button
        className="btn btn--primary"
        onClick={handleImport}
        disabled={!code.trim()}
      >
        Import Profile
      </button>
    </Panel>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function SavesPage() {
  const {
    saves, activeSave, editingId, form,
    tailorToSave, marriageableNpcs,
    startCreate, startEdit, cancelEdit, submitForm,
    deleteSave, setActiveSave,
    setTailorToSave,
    setFormField, setSkill,
  } = useSaves();

  usePageTitle('Save Profiles');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  const toggleExport = (id: string) =>
    setExportingId((prev) => (prev === id ? null : id));

  return (
    <div className="page page--saves">
      <h1 className="page__title">Save Profiles</h1>

      <Panel title="App Settings">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={tailorToSave}
            onChange={(e) => setTailorToSave(e.target.checked)}
          />
          Tailor app to active save
          <span className="toggle-label__hint">
            Personalises crop quality, schedules, and quest tracking to match your profile.
          </span>
        </label>
      </Panel>

      {editingId && (
        <Panel title={editingId === 'new' ? 'New Save Profile' : 'Edit Save Profile'} className="save-form-panel">
          <form
            className="save-form"
            onSubmit={(e) => { e.preventDefault(); submitForm(); }}
          >
            <label className="form-field">
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setFormField('name', e.target.value)}
                placeholder="My Farm"
                required
              />
            </label>

            <label className="form-field">
              Farm Type
              <select
                value={form.farmType}
                onChange={(e) => setFormField('farmType', e.target.value as FarmType)}
              >
                {FARM_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {ft.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-field">
              <span className="form-field__label">Date</span>
              <StardewDateInput
                season={form.season as Season}
                day={form.day}
                year={form.year}
                onSeasonChange={(s) => setFormField('season', s)}
                onDayChange={(d) => setFormField('day', d)}
                onYearChange={(y) => setFormField('year', y)}
                showYear
              />
            </div>

            <div className="form-field">
              <span className="form-field__label">Skills</span>
              <div className="skills-grid">
                {SKILLS.map((skill) => (
                  <label key={skill} className="skill-field">
                    {skill.charAt(0).toUpperCase() + skill.slice(1)}
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.skills[skill]}
                      onChange={(e) => setSkill(skill, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <label className="form-field">
              Married to
              <select
                value={form.marriedTo}
                onChange={(e) => setFormField('marriedTo', e.target.value)}
              >
                <option value="">None</option>
                {marriageableNpcs.map((npc) => (
                  <option key={npc} value={npc}>{npc}</option>
                ))}
              </select>
            </label>

            <div className="save-form__actions">
              <button type="submit" className="btn btn--primary">Save</button>
              <button type="button" className="btn" onClick={cancelEdit}>Cancel</button>
            </div>
          </form>
        </Panel>
      )}

      {saves.length === 0 && !editingId ? (
        <div className="empty-state">
          <p>No save profiles yet.</p>
          <button className="btn btn--primary" onClick={startCreate}>Create your first profile</button>
        </div>
      ) : (
        <>
          <div className="save-list">
            {saves.map((save) => (
              <div key={save.id} className="save-entry">
                <div
                  className={[
                    'save-card',
                    activeSave?.id === save.id  ? 'save-card--active'    : '',
                    exportingId   === save.id   ? 'save-card--exporting' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="save-card__info">
                    <span className="save-card__name">{save.name}</span>
                    {activeSave?.id === save.id && (
                      <span className="save-card__active-badge">Active</span>
                    )}
                    <span className="save-card__meta">
                      {save.farmType.replace(/[-_]/g, ' ')} farm · Year {save.year}
                      {save.season && save.day
                        ? ` · ${SEASON_LABELS[save.season as Season]} Day ${save.day}`
                        : ''}
                      {save.marriedTo ? ` · Married to ${save.marriedTo}` : ''}
                    </span>
                    <span className="save-card__skills">
                      {SKILLS.map((s) => `${s.charAt(0).toUpperCase()}: ${save.skills[s]}`).join(' · ')}
                    </span>
                    {(save.money != null || save.deepestMineLevel != null || save.goldenWalnuts != null || save.communityStatus != null) && (
                      <span className="save-card__meta save-card__meta--extra">
                        {save.money != null ? `${save.money.toLocaleString()}g` : null}
                        {save.deepestMineLevel != null && save.deepestMineLevel > 0
                          ? ` · Mine ${save.deepestMineLevel}/120` : null}
                        {save.deepestSkullCavernLevel != null && save.deepestSkullCavernLevel > 0
                          ? ` · Skull Cavern ${save.deepestSkullCavernLevel}` : null}
                        {save.goldenWalnuts != null && save.goldenWalnuts > 0
                          ? ` · ${save.goldenWalnuts} 🌰` : null}
                        {save.communityStatus === 'cc-restored'   ? ' · CC ✓' : null}
                        {save.communityStatus === 'joja-complete' ? ' · Joja ✓' : null}
                        {save.communityStatus === 'joja-member'   ? ' · Joja member' : null}
                      </span>
                    )}
                  </div>
                  <div className="save-card__actions">
                    {activeSave?.id !== save.id && (
                      <button className="btn btn--sm btn--primary" onClick={() => setActiveSave(save.id)}>
                        Set Active
                      </button>
                    )}
                    <button className="btn btn--sm" onClick={() => startEdit(save)}>Edit</button>
                    <button
                      className={`btn btn--sm${exportingId === save.id ? ' btn--primary' : ''}`}
                      onClick={() => toggleExport(save.id)}
                    >
                      {exportingId === save.id ? 'Hide Export' : 'Export'}
                    </button>
                    <CreateRoomButton save={save} />
                    {deletingId === save.id ? (
                      <>
                        <span className="save-card__delete-confirm">Really delete?</span>
                        <button
                          className="btn btn--sm btn--danger"
                          onClick={() => { deleteSave(save.id); setDeletingId(null); }}
                        >
                          Yes, delete
                        </button>
                        <button className="btn btn--sm" onClick={() => setDeletingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() => setDeletingId(save.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {exportingId === save.id && (
                  <ExportPanel save={save} onClose={() => setExportingId(null)} />
                )}
              </div>
            ))}
          </div>

          {!editingId && (
            <button className="btn btn--primary" onClick={startCreate}>New Profile</button>
          )}
        </>
      )}

      <Panel title="Import from Game Save File" className="save-import-panel">
        <SaveFileUpload />
      </Panel>

      <ImportSection />

      <SyncPanel />

      <p className="saves-page__join-hint">
        Got a join code from a friend?{' '}
        <Link to="/join">Enter it here →</Link>
      </p>
    </div>
  );
}
