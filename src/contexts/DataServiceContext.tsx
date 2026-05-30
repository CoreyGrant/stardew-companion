import { createContext, useContext, type ReactNode } from 'react';
import { DataService } from '../data/DataService';
import { LocalStorageAdapter } from '../data/LocalStorageAdapter';

const service = new DataService(new LocalStorageAdapter());

const DataServiceContext = createContext<DataService>(service);

export function DataServiceProvider({ children }: { children: ReactNode }) {
  return (
    <DataServiceContext.Provider value={service}>
      {children}
    </DataServiceContext.Provider>
  );
}

export function useDataService(): DataService {
  return useContext(DataServiceContext);
}
