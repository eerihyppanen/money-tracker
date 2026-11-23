import type { ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './data/DataProvider';
import { Layout } from './ui/Layout';
import { EntryPage } from './ui/pages/EntryPage';
import { ListPage } from './ui/pages/ListPage';
import { MonthPage } from './ui/pages/MonthPage';
import { OverviewPage } from './ui/pages/OverviewPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { useDismissUndo } from './ui/undoContext';
import { UndoProvider } from './ui/UndoProvider';

export function App() {
  return (
    <UndoProvider>
      <Data>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<OverviewPage />} />
              <Route path="list" element={<ListPage />} />
              <Route path="month" element={<MonthPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="entry/new" element={<EntryPage />} />
              <Route path="entry/:id" element={<EntryPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </Data>
    </UndoProvider>
  );
}

/** The data layer, set to close a pending Undo whenever the data changes some other way. */
function Data({ children }: { children: ReactNode }) {
  return <DataProvider onWrite={useDismissUndo()}>{children}</DataProvider>;
}
