import React, { useState } from 'react';
import { AppProvider } from './services/StateContext';
import { Layout } from './components/Layout';

const TestHookComponent = () => {
  console.log("TestHookComponent rendering");
  const [count, setCount] = useState(0);
  return (
    <div className="p-20 text-center">
      <h1 className="text-2xl font-bold">React Hook Test</h1>
      <p className="my-4 text-xl">Count: {count}</p>
      <button
        className="px-6 py-2 bg-blue-500 text-white rounded shadow"
        onClick={() => setCount(c => c + 1)}
      >
        Increment
      </button>
    </div>
  );
};

const App = () => {
  console.log("App rendering");
  return (
    <AppProvider>
      <Layout>
        <TestHookComponent />
      </Layout>
    </AppProvider>
  );
};

export default App;
