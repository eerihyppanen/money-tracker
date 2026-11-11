import { HashRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './data/DataProvider';
import { Layout } from './ui/Layout';
import { EntryPage } from './ui/pages/EntryPage';
import { ListPage } from './ui/pages/ListPage';
import { MonthPage } from './ui/pages/MonthPage';
import { OverviewPage } from './ui/pages/OverviewPage';
import { SettingsPage } from './ui/pages/SettingsPage';

export function App() {
  return (
    <DataProvider>
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
    </DataProvider>
  );
}
