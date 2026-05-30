import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { GameData } from '../types/game';

interface GameDataState {
  data: GameData | null;
  loading: boolean;
  error: string | null;
}

const GameDataContext = createContext<GameDataState>({
  data: null,
  loading: true,
  error: null,
});

export function GameDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameDataState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}gamedata.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load game data (HTTP ${res.status})`);
        return res.json() as Promise<GameData>;
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err: unknown) =>
        setState({ data: null, loading: false, error: String(err) })
      );
  }, []);

  return (
    <GameDataContext.Provider value={state}>
      {children}
    </GameDataContext.Provider>
  );
}

export function useGameData(): GameDataState {
  return useContext(GameDataContext);
}
