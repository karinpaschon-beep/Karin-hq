import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../services/StateContext';

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  console.log("Layout with useApp rendering");
  const [test, setTest] = useState(false);
  const location = useLocation();

  let appData = "Loading...";
  try {
    const app = useApp();
    appData = `Categories: ${app.categories.length}`;
  } catch (e) {
    console.error("useApp error in Layout:", e);
    appData = "Error calling useApp";
  }

  return (
    <div className="p-4 border-4 border-orange-500">
      <h1>Layout with useApp</h1>
      <p>Path: {location.pathname}</p>
      <p>Data: {appData}</p>
      <p>State: {test ? 'True' : 'False'}</p>
      <button
        className="px-4 py-1 bg-orange-100 rounded"
        onClick={() => setTest(!test)}
      >
        Toggle Layout State
      </button>
      <div className="mt-4">
        {children}
      </div>
    </div>
  );
};
