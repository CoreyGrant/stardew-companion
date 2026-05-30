import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { InlineNavGroups, ThemeDropdown, MobileDrawer } from './Nav';
import { GlobalSearch } from '../common/GlobalSearch';
import { useUserData } from '../../contexts/UserDataContext';

// Only defined when VITE_DISCORD_INVITE is set at build time (GitHub Actions variable)
const DISCORD_INVITE = import.meta.env.VITE_DISCORD_INVITE as string | undefined;

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.012.043.035.057a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

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

        {/* Right group — search + discord + theme + save badge, all pushed to the right */}
        <div className="app-header__right">
          <GlobalSearch />

          {DISCORD_INVITE && (
            <a
              href={DISCORD_INVITE}
              className="app-header__discord"
              target="_blank"
              rel="noopener noreferrer"
              title="Join the Discord"
              aria-label="Join the Stardew Companion Discord server"
            >
              <DiscordIcon />
            </a>
          )}

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
