import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  console.log("Layout with hooks rendering");
  const [test, setTest] = useState(false);
  const location = useLocation();

  return (
    <div className="p-4 border-4 border-purple-500">
      <h1>Layout with Hooks</h1>
      <p>Path: {location.pathname}</p>
      <p>State: {test ? 'True' : 'False'}</p>
      <button
        className="px-4 py-1 bg-purple-100 rounded"
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
