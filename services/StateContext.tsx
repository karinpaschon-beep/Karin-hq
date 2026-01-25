import React, { createContext, useContext } from 'react';
import { AppContextType } from '../types';

// Minimal context definition
const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    console.log("Dummy AppProvider rendering");
    // We are bypassing the state logic to see if the component itself crashes
    return <AppContext.Provider value={undefined as any}>{children}</AppContext.Provider>;
};

export const useApp = () => {
    const context = useContext(AppContext);
    // Return empty object to prevent crashes in components that use this hook
    // (though they shouldn't be rendering if we are testing isolation)
    return context || {} as AppContextType;
};
