import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { InlineNavGroups, ThemeDropdown, MobileDrawer } from './Nav';
import { GlobalSearch } from '../common/GlobalSearch';
import { useUserData } from '../../contexts/UserDataContext';

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const { activeSave, settings } = useUserData();
  const location = useLocation();
  const isPlanner = location.pathname === '/farm-planner' || location.pathname === '/island-farm';

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        {/* Hamburger — mobile only (hidden at $bp-nav+ via CSS) */}
        <button
          className="app-header__burger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
        >
          ☰
        </button>

        <Link to="/" className="app-header__title">
          Stardew Companion
        </Link>

        {/* Inline nav groups — hidden on mobile, flex at $bp-nav+ */}
        <div className="app-header__nav" aria-label="Main navigation">
          <InlineNavGroups />
        </div>

        {/* Right group — search + theme + save badge, all pushed to the right */}
        <div className="app-header__right">
          <GlobalSearch />

          {/* Theme dropdown — hidden on mobile, flex at $bp-nav+ */}
          <div className="app-header__theme">
            <ThemeDropdown />
          </div>

          {settings.tailorToSave && activeSave && (
            <span className="app-header__save-badge">{activeSave.name}</span>
          )}
        </div>
      </header>

      {/* Mobile side drawer — only visible when open, hidden at $bp-nav+ */}
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className={`app-main${isPlanner ? ' app-main--planner' : ''}`} id="main-content">
        {children}
      </main>
    </div>
  );
}
