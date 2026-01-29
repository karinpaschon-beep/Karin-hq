import React from 'react';

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  console.log("Pure Layout rendering");
  return (
    <div className="p-4 border-4 border-green-500">
      <h1>Pure Layout (No Hooks)</h1>
      {children}
    </div>
  );
};
