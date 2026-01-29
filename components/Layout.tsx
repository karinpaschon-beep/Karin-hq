import React, { useState } from 'react';

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  console.log("Layout with useState rendering");
  const [test, setTest] = useState(false);

  return (
    <div className="p-4 border-4 border-blue-500">
      <h1>Layout with useState</h1>
      <p>State: {test ? 'True' : 'False'}</p>
      <button
        className="px-4 py-1 bg-blue-100 rounded"
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
