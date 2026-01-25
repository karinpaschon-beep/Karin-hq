import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './services/StateContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { CategoryPage } from './pages/CategoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

const App = () => {
  console.log("App rendering...");
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">App Component Loaded</h1>
      <p>If you see this, the crash is inside the Providers or Router.</p>
    </div>
  );
  /*
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/category/:category" element={<CategoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppProvider>
  );
  */
};

export default App;
