import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  console.log("DebugLayout rendering");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  console.log("DebugLayout hooks passed", location.pathname);

  return (
    <div className="p-4">
      <h1>Debug Layout</h1>
      <p>Sidebar: {isSidebarOpen ? 'Open' : 'Closed'}</p>
      <button onClick={() => setSidebarOpen(!isSidebarOpen)}>Toggle</button>
      <div className="mt-4 border p-4">
        {children}
      </div>
    </div>
  );
};
