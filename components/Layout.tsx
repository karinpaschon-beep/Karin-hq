
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Home, Settings as SettingsIcon, CheckCircle2 } from 'lucide-react';
import { ICON_MAP } from '../constants';
import { cn } from './ui';
import { useApp } from '../services/StateContext';

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Get dynamic categories from context
  let notifications: any[] = [];
  let categories: any[] = [];
  try {
    const app = useApp();
    notifications = app.notifications;
    categories = app.categories;
  } catch (e) {
    // ignore
  }

  // Determine background image
  let backgroundImage = '/bg-dashboard.png'; // Default
  const isCategoryPage = location.pathname.startsWith('/category/');
  if (isCategoryPage) {
    const categoryId = decodeURIComponent(location.pathname.split('/category/')[1]);
    const category = categories.find(c => c.id === categoryId);
    if (category?.backgroundImage) {
      backgroundImage = category.backgroundImage;
    }
  }

  const closeSidebar = () => setSidebarOpen(false);

  const NavItem: React.FC<{ to: string; icon?: any; label: string; exact?: boolean }> = ({ to, icon: Icon, label, exact = false }) => (
    <NavLink
      to={to}
      onClick={closeSidebar}
      end={exact}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )
      }
    >
      {Icon && <Icon size={18} />}
      {!Icon && <span className="w-4 h-4 rounded-full border border-slate-300 mr-1 opacity-50"></span>}
      {label}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row relative">
      {/* Background Image Layer */}
      <div
        className="absolute inset-0 z-0 opacity-15 pointer-events-none bg-cover bg-center fixed"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="font-bold text-lg flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">K</div>
          Karin HQ
        </div>
        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-600">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 overflow-y-auto",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 hidden md:flex items-center gap-2 font-bold text-xl text-slate-800">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-sm">K</div>
          Karin HQ
        </div>

        <nav className="px-4 pb-4 md:py-2 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-4">Overview</div>
          <NavItem to="/" icon={Home} label="Dashboard" exact />
          <NavItem to="/settings" icon={SettingsIcon} label="Settings" />

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Categories</div>
          {categories.map(cat => {
            const Icon = ICON_MAP[cat.icon || 'Star'] || ICON_MAP['Star'];
            return <NavItem key={cat.id} to={`/category/${encodeURIComponent(cat.id)}`} icon={Icon} label={cat.name} />;
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full relative">
        {children}
      </main>

      {/* Notifications Overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center gap-3">
            <div className="bg-green-500 rounded-full p-1"><CheckCircle2 size={14} className="text-white" /></div>
            <span className="font-medium text-sm">{n.message}</span>
          </div>
        ))}
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-0 md:hidden"
          onClick={closeSidebar}
        />
      )}
    </div>
  );
};
