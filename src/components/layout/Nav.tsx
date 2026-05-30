import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme, type Theme } from '../../contexts/ThemeContext';

// ── Navigation data ────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'reference',
    label: 'Reference',
    items: [
      { to: '/items',     label: 'Items',      icon: '📦' },
      { to: '/crops',     label: 'Crops',      icon: '🌾' },
      { to: '/machines',  label: 'Machines',   icon: '⚙️' },
      { to: '/recipes',   label: 'Recipes',    icon: '🍳' },
      { to: '/foraging',  label: 'Foraging',   icon: '🍄' },
      { to: '/shops',     label: 'Shops',      icon: '🛒' },
      { to: '/fish',      label: 'Fish Guide', icon: '🎣' },
      { to: '/fish-pond', label: 'Fish Pond',  icon: '🐟' },
    ],
  },
  {
    id: 'villagers',
    label: 'Villagers',
    items: [
      { to: '/characters', label: 'Characters', icon: '👥' },
      { to: '/gifts',      label: 'Gift Guide', icon: '🎁' },
      { to: '/schedule',   label: 'Schedules',  icon: '📅' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    items: [
      { to: '/calendar',     label: 'Calendar',      icon: '🗓️' },
      { to: '/farm-planner', label: 'Farm Planner',  icon: '🗺️' },
      { to: '/island-farm',  label: 'Ginger Island', icon: '🌴' },
    ],
  },
  {
    id: 'progress',
    label: 'Progress',
    items: [
      { to: '/bundles', label: 'Bundles', icon: '📋' },
      { to: '/quests',  label: 'Quests',  icon: '📜' },
      { to: '/museum',  label: 'Museum',  icon: '🏛️' },
    ],
  },
];

const NAV_STANDALONE: NavItem[] = [
  { to: '/saves', label: 'Profiles', icon: '💾' },
];

const THEME_OPTIONS: { value: Theme; icon: string; label: string }[] = [
  { value: 'stardew', icon: '🌾', label: 'Stardew' },
  { value: 'light',   icon: '☀️', label: 'Light'   },
  { value: 'dark',    icon: '🌙', label: 'Dark'    },
];

// ── Class helpers ──────────────────────────────────────────────────────────────

function linkClass({ isActive }: { isActive: boolean }) {
  return `nav-group__item${isActive ? ' nav-group__item--active' : ''}`;
}

function standaloneClass({ isActive }: { isActive: boolean }) {
  return `nav-standalone-link${isActive ? ' nav-standalone-link--active' : ''}`;
}

function drawerItemClass({ isActive }: { isActive: boolean }) {
  return `nav-drawer__item${isActive ? ' nav-drawer__item--active' : ''}`;
}

// ── Single nav group (stateless — timer lives in parent) ──────────────────────

interface NavGroupProps {
  group: NavGroup;
  isOpen: boolean;
  /** Mouse/focus entered this group — parent should cancel the close timer */
  onEnter: () => void;
  /** Mouse/focus left this group — parent should schedule a close */
  onLeave: () => void;
  /** Immediate close (used when a link is clicked) */
  onClose: () => void;
}

function NavGroupComponent({ group, isOpen, onEnter, onLeave, onClose }: NavGroupProps) {
  return (
    <div
      className="nav-group"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <button
        className={`nav-group__trigger${isOpen ? ' nav-group__trigger--active' : ''}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {group.label}
      </button>
      {isOpen && (
        <div className="nav-group__dropdown" role="menu">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClass}
              role="menuitem"
              onClick={onClose}
            >
              <span className="nav-group__item__icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline nav groups (rendered inside <header>) ───────────────────────────────
//
// The close timer lives HERE (not per-group) so that entering ANY group always
// cancels a pending close that was started by a DIFFERENT group. Without this,
// moving from group A → B leaves A's stale 500ms timer running; it would fire
// and close B's dropdown even though the mouse is still inside B.

const CLOSE_DELAY_MS = 300;

export function InlineNavGroups() {
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  };

  const closeNow = () => { cancelClose(); setOpenId(null); };

  useEffect(() => () => cancelClose(), []);

  return (
    <>
      {NAV_GROUPS.map((group) => (
        <NavGroupComponent
          key={group.id}
          group={group}
          isOpen={openId === group.id}
          onEnter={() => { cancelClose(); setOpenId(group.id); }}
          onLeave={scheduleClose}
          onClose={closeNow}
        />
      ))}

      {NAV_STANDALONE.map((item) => (
        <NavLink key={item.to} to={item.to} className={standaloneClass}>
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

// ── Theme dropdown (single icon → small menu) ──────────────────────────────────

export function ThemeDropdown() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const handleEnter = () => { clearTimer(); setOpen(true); };
  const handleLeave = () => { timerRef.current = setTimeout(() => setOpen(false), 300); };

  useEffect(() => () => clearTimer(), []);

  const current = THEME_OPTIONS.find((o) => o.value === theme)!;

  return (
    <div
      className="theme-dropdown"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className={`theme-dropdown__trigger${open ? ' theme-dropdown__trigger--open' : ''}`}
        title={`Theme: ${current.label}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {current.icon}
      </button>
      {open && (
        <div className="theme-dropdown__menu" role="menu">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`theme-dropdown__option${theme === opt.value ? ' theme-dropdown__option--active' : ''}`}
              role="menuitem"
              onClick={() => { setTheme(opt.value); setOpen(false); }}
            >
              <span className="theme-dropdown__option-icon">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile drawer ──────────────────────────────────────────────────────────────

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: DrawerProps) {
  const { theme, setTheme } = useTheme();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Focus trap: keep Tab/Shift+Tab inside the panel while open
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const firstBtn = panel.querySelector<HTMLElement>('button,a[href]');
    firstBtn?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className={`nav-drawer${isOpen ? ' nav-drawer--open' : ''}`} aria-hidden={!isOpen}>
      <button
        className="nav-drawer__overlay"
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={isOpen ? 0 : -1}
      />
      <div className="nav-drawer__panel" role="dialog" aria-modal="true" aria-label="Navigation" ref={panelRef}>
        <div className="nav-drawer__header">
          <span className="nav-drawer__header-title">Stardew Companion</span>
          <button className="nav-drawer__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="nav-drawer__content">
          {NAV_GROUPS.map((group) => {
            const isGroupOpen = openGroups.has(group.id);
            return (
              <div key={group.id} className="nav-drawer__group">
                <button
                  className="nav-drawer__group-btn"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isGroupOpen}
                >
                  {group.label}
                  <span className={`nav-drawer__group-btn-chevron${isGroupOpen ? ' nav-drawer__group-btn-chevron--open' : ''}`}>
                    ▾
                  </span>
                </button>
                {isGroupOpen && (
                  <div className="nav-drawer__group-items">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={drawerItemClass}
                        onClick={onClose}
                      >
                        <span className="nav-drawer__item__icon">{item.icon}</span>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="nav-drawer__standalone">
            {NAV_STANDALONE.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={drawerItemClass}
                onClick={onClose}
              >
                <span className="nav-drawer__item__icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="nav-drawer__footer">
          <div className="nav-drawer__theme-label">Theme</div>
          <div className="nav-drawer__theme-btns">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`nav-drawer__theme-btn${theme === opt.value ? ' nav-drawer__theme-btn--active' : ''}`}
                onClick={() => setTheme(opt.value)}
                aria-pressed={theme === opt.value}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
