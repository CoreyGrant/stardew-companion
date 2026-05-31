import { useRef, useState } from 'react';
import { useGameData } from '../../contexts/GameDataContext';
import { useUserData } from '../../contexts/UserDataContext';
import { parseSdvSave } from '../../utils/sdvSaveParser';
import type { SdvParseResult } from '../../utils/sdvSaveParser';
import type { SaveFile } from '../../types/save';
import type { Season } from '../../types/game';

// ── Preview helpers ────────────────────────────────────────────────────────────

const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter',
};

function fmtFarmType(ft: string): string {
  return ft.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtDate(save: Omit<SaveFile, 'id' | 'createdAt'>): string {
  const s = save.season ? SEASON_LABELS[save.season] : 'Spring';
  return `${s} Day ${save.day ?? 1}, Year ${save.year}`;
}

function fmtSkills(save: Omit<SaveFile, 'id' | 'createdAt'>): string {
  const sk = save.skills;
  return (
    `Farming ${sk.farming} · Mining ${sk.mining} · ` +
    `Foraging ${sk.foraging} · Fishing ${sk.fishing} · Combat ${sk.combat}`
  );
}

function fmtMoney(n: number): string {
  return n.toLocaleString() + 'g';
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="sdv-upload__preview-label">{label}</span>
      <span className="sdv-upload__preview-value">{value}</span>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ParsedPreview {
  result: SdvParseResult;
  fileName: string;
}

export function SaveFileUpload() {
  const { data: gameData } = useGameData();
  const { createSave }     = useUserData();
  const fileInputRef       = useRef<HTMLInputElement>(null);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [preview,  setPreview]  = useState<ParsedPreview | null>(null);
  const [imported, setImported] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setPreview(null);
    setImported(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gameData) return;

    reset();
    setLoading(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setError('Could not read the file. Make sure you have permission to access it.');
      setLoading(false);
    };
    reader.onload = (evt) => {
      // Zero-timeout lets React paint the spinner before the synchronous parse.
      setTimeout(() => {
        try {
          const text   = evt.target?.result as string;
          const result = parseSdvSave(text, gameData);
          setPreview({ result, fileName: file.name });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to parse save file.');
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }, 0);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImport = () => {
    if (!preview) return;
    // Store the source filename so the navbar Sync button can prompt for the same file.
    const save = createSave({ ...preview.result.save, sourceFileName: preview.fileName });
    setImported(save.name);
    setPreview(null);
  };

  const save = preview?.result.save;
  const bundleCount   = Object.keys(save?.bundleProgress  ?? {}).length;
  const museumCount   = (save?.museumDonations ?? []).length;
  const heartCount    = Object.keys(save?.heartLevels     ?? {}).length;
  const recipeCount   = (save?.learnedCookingRecipes ?? []).length;
  const buildingCount = (save?.farmLayout.buildings.filter(b => !b.isStatic) ?? []).length;

  function fmtCommunity(save: Omit<SaveFile, 'id' | 'createdAt'>): string {
    switch (save.communityStatus) {
      case 'cc-restored':   return '✓ Community Centre restored';
      case 'joja-complete': return '✓ Joja development complete';
      case 'joja-member':   return `Joja member — ${bundleCount} project(s) done`;
      default: return `${bundleCount} bundle(s) with progress`;
    }
  }

  return (
    <div className="sdv-upload">
      {/* ── Instructions ──────────────────────────────────────────────────── */}
      {!preview && !loading && !imported && (
        <>
          <p className="sdv-upload__hint">
            Upload your Stardew Valley save file to populate this profile automatically.
            Find it at:
          </p>
          <ul className="sdv-upload__paths">
            <li><strong>Windows:</strong>{' '}
              <code>%AppData%\Roaming\StardewValley\Saves\FarmName_ID\FarmName_ID</code>
            </li>
            <li><strong>Mac / Linux:</strong>{' '}
              <code>~/.config/StardewValley/Saves/FarmName_ID/FarmName_ID</code>
            </li>
          </ul>
          <p className="sdv-upload__hint">
            The save file has <em>no extension</em>. Only version 1.6 saves are supported.
          </p>
        </>
      )}

      {/* ── File picker ───────────────────────────────────────────────────── */}
      {!preview && !loading && (
        <div className="sdv-upload__row">
          <input
            ref={fileInputRef}
            type="file"
            id="sdv-file-input"
            className="sdv-upload__file-input"
            onChange={handleFileChange}
            aria-label="Choose Stardew Valley save file"
          />
          <label htmlFor="sdv-file-input" className="btn btn--primary">
            Choose Save File
          </label>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="sdv-upload__spinner" role="status" aria-live="polite">
          <span className="sdv-upload__spinner-anim" aria-hidden="true" />
          Reading &amp; parsing save file
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="sdv-upload__error" role="alert">
          <span className="sdv-upload__error-icon">✗</span>
          <span>{error}</span>
          <button className="btn btn--sm" onClick={reset}>Try again</button>
        </div>
      )}

      {/* ── Imported success ──────────────────────────────────────────────── */}
      {imported && (
        <div className="sdv-upload__success">
          <span>✓ Imported <strong>"{imported}"</strong> — it now appears in your save list below.</span>
          <button className="btn btn--sm" onClick={reset}>Import another</button>
        </div>
      )}

      {/* ── Preview ───────────────────────────────────────────────────────── */}
      {preview && save && (
        <div className="sdv-upload__preview">
          <p className="sdv-upload__preview-title">
            Preview — <em>{preview.fileName}</em>
          </p>

          <div className="sdv-upload__preview-grid">
            <PreviewRow label="Profile name" value={save.name} />
            <PreviewRow label="Farm type"    value={fmtFarmType(save.farmType)} />
            <PreviewRow label="Date"         value={fmtDate(save)} />
            <PreviewRow label="Skills"       value={fmtSkills(save)} />
            {save.marriedTo && (
              <PreviewRow label="Married to" value={save.marriedTo} />
            )}
            {(save.money ?? 0) > 0 && (
              <PreviewRow label="Money"      value={fmtMoney(save.money!)} />
            )}
            {(save.deepestMineLevel ?? 0) > 0 && (
              <PreviewRow label="Mines"            value={`Floor ${save.deepestMineLevel}/120`} />
            )}
            {(save.deepestSkullCavernLevel ?? 0) > 0 && (
              <PreviewRow label="Skull Cavern"     value={`Floor ${save.deepestSkullCavernLevel}`} />
            )}
            {(save.goldenWalnuts ?? 0) > 0 && (
              <PreviewRow label="Golden walnuts"   value={String(save.goldenWalnuts)} />
            )}
            <PreviewRow label="Community"     value={fmtCommunity(save)} />
            <PreviewRow label="Museum"        value={`${museumCount} donations`} />
            <PreviewRow label="Relationships" value={`${heartCount} NPCs`} />
            <PreviewRow label="Recipes known" value={`${recipeCount} cooking recipes`} />
            <PreviewRow label="Buildings"     value={`${buildingCount} placed`} />
          </div>

          {preview.result.warnings.length > 0 && (
            <details className="sdv-upload__warnings">
              <summary>
                {preview.result.warnings.length} minor warning
                {preview.result.warnings.length !== 1 ? 's' : ''}
              </summary>
              <ul>
                {preview.result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </details>
          )}

          <div className="sdv-upload__preview-actions">
            <button className="btn btn--primary" onClick={handleImport}>
              Import as New Profile
            </button>
            <button className="btn" onClick={reset}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
