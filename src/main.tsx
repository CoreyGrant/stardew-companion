import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { DataServiceProvider } from './contexts/DataServiceContext';
import { GameDataProvider } from './contexts/GameDataContext';
import { UserDataProvider } from './contexts/UserDataContext';
import { SyncProvider } from './contexts/SyncContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { App } from './App';
import './styles/main.scss';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <DataServiceProvider>
          <GameDataProvider>
            <UserDataProvider>
              <SyncProvider>
                <App />
              </SyncProvider>
            </UserDataProvider>
          </GameDataProvider>
        </DataServiceProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>
);
