import { Routes, Route } from 'react-router-dom';
import { useGameData } from './contexts/GameDataContext';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { HomePage } from './pages/HomePage';
import { NPCListPage } from './pages/NPCListPage';
import { NPCDetailPage } from './pages/NPCDetailPage';
import { ScheduleViewerPage } from './pages/ScheduleViewerPage';
import { ItemListPage } from './pages/ItemListPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { QuestListPage } from './pages/QuestListPage';
import { QuestDetailPage } from './pages/QuestDetailPage';
import { BundlesPage } from './pages/BundlesPage';
import { FarmPlannerPage } from './pages/FarmPlannerPage';
import { IslandFarmPlannerPage } from './pages/IslandFarmPlannerPage';
import { SavesPage } from './pages/SavesPage';
import { CropsPage } from './pages/CropsPage';
import { GiftGuidePage } from './pages/GiftGuidePage';
import { FishGuidePage } from './pages/FishGuidePage';
import { RecipesPage } from './pages/RecipesPage';
import { SeasonalCalendarPage } from './pages/SeasonalCalendarPage';
import { MachinesPage } from './pages/MachinesPage';
import { MuseumPage } from './pages/MuseumPage';
import { ForagingPage } from './pages/ForagingPage';
import { ShopsPage } from './pages/ShopsPage';
import { FishPondPage } from './pages/FishPondPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  const { loading, error } = useGameData();

  if (loading) {
    return (
      <div className="splash">
        <p className="splash__text">Loading Stardew Companion…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="splash splash--error">
        <p className="splash__text">Failed to load game data.</p>
        <p className="splash__detail">{error}</p>
      </div>
    );
  }

  return (
    <>
    <OnboardingModal />
    <AppShell>
      <ErrorBoundary section="page">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/characters" element={<NPCListPage />} />
        <Route path="/characters/:id" element={<NPCDetailPage />} />
        <Route path="/schedule" element={<ScheduleViewerPage />} />
        <Route path="/items" element={<ItemListPage />} />
        <Route path="/items/:id" element={<ItemDetailPage />} />
        <Route path="/quests" element={<QuestListPage />} />
        <Route path="/quests/:id" element={<QuestDetailPage />} />
        <Route path="/bundles" element={<BundlesPage />} />
        <Route path="/farm-planner" element={<FarmPlannerPage />} />
        <Route path="/island-farm" element={<IslandFarmPlannerPage />} />
        <Route path="/saves" element={<SavesPage />} />
        <Route path="/crops" element={<CropsPage />} />
        <Route path="/gifts" element={<GiftGuidePage />} />
        <Route path="/fish" element={<FishGuidePage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/calendar" element={<SeasonalCalendarPage />} />
        <Route path="/machines" element={<MachinesPage />} />
        <Route path="/museum" element={<MuseumPage />} />
        <Route path="/foraging" element={<ForagingPage />} />
        <Route path="/shops" element={<ShopsPage />} />
        <Route path="/fish-pond" element={<FishPondPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </ErrorBoundary>
    </AppShell>
    </>
  );
}
