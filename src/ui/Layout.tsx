import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useData } from '../data/dataContext';
import { CalendarIcon, ListIcon, OverviewIcon, PlusIcon, SettingsIcon } from './components/icons';

const NAV = [
  { to: '/', label: 'Overview', Icon: OverviewIcon, end: true },
  { to: '/list', label: 'Entries', Icon: ListIcon, end: false },
  { to: '/month', label: 'Months', Icon: CalendarIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
];

export function Layout() {
  const { loading, error } = useData();
  const { pathname } = useLocation();
  // No floating add button where it would only cover things: the form itself and Settings.
  const showAddButton = !pathname.startsWith('/entry') && pathname !== '/settings';

  // Each page opens at the top instead of keeping the previous page's scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar on wide screens */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-6 md:border-r md:border-line md:px-4 md:py-6 md:sticky md:top-0 md:h-dvh">
        <div className="px-3 text-lg font-semibold tracking-tight">Money left over</div>
        <Link
          to="/entry/new"
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-medium text-accent-ink"
        >
          <PlusIcon width={20} height={20} />
          Add entry
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 ${
                  isActive ? 'bg-surface font-medium text-ink' : 'text-muted hover:text-ink'
                }`
              }
            >
              <Icon width={20} height={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-4xl px-4 pt-6 pb-32 md:px-8 md:pb-12">
        {error ? (
          <p role="alert" className="text-expense">
            Could not open the on-device database: {error}. Check that the browser is not in private
            mode and has storage enabled.
          </p>
        ) : loading ? null : (
          <Outlet />
        )}
      </main>

      {/* Floating add button on phones */}
      {showAddButton && (
        <Link
          to="/entry/new"
          aria-label="Add entry"
          className="fixed right-4 z-20 flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg md:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
        >
          <PlusIcon />
        </Link>
      )}

      {/* Bottom tab bar on phones */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-bg/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-accent font-medium' : 'text-muted'}`
            }
          >
            <Icon width={22} height={22} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
