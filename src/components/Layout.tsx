import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Home, PlusCircle, Settings, LogOut, Map, Book, Download } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  const { user, profile, logout } = useAuth();
  const location = useLocation();

  if (!user || !profile) return null;

  const navItems = [
    { name: 'Deník', path: '/', icon: Home },
    { name: 'Slovník', path: '/species', icon: Book },
    { name: 'Export', path: '/export', icon: Download },
    { name: 'Nastavení', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans flex flex-col md:flex-row">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-stone-200">
        <div className="p-6">
          <h1 className="text-2xl font-serif font-bold text-stone-800">Houbařský Deník</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                  isActive ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-100"
                )}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-stone-200">
          <div className="flex items-center gap-3 mb-4 px-2">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center">
                {profile.displayName?.charAt(0) || user.email?.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{profile.displayName}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2 w-full text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Odhlásit</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between z-10">
          <h1 className="text-xl font-serif font-bold text-stone-800">Houbařský Deník</h1>
          {profile.photoURL && (
            <img src={profile.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around items-center p-2 pb-safe z-20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg min-w-[64px]",
                  isActive ? "text-stone-800" : "text-stone-400"
                )}
              >
                <Icon size={24} className={cn("mb-1", isActive && "fill-stone-800/20")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
