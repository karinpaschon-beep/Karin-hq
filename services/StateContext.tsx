import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppContextType, Category, StreakCheckIn, XpTask, RewardLedgerEntry, Settings, Notification, Project, CategoryDef } from '../types';
import { generateSeedData, INITIAL_SETTINGS, COLOR_THEMES, REWARD_COMPLIMENTS, EMOJI_SETS, DEFAULT_MINI_TASKS } from '../constants';
import { format, eachDayOfInterval, addDays, getISOWeek, parseISO as dateFnsParseISO, startOfDay as dateFnsStartOfDay } from 'date-fns';
import { suggestProjectTasks } from './ai';
import { supabase, loadStateFromCloud, saveStateToCloud } from './supabase';
import { User } from '@supabase/supabase-js';

const LOCAL_STORAGE_KEY = 'karin_hq_data_v3';
const LEGACY_KEYS = ['karin_hq_data', 'karin_hq_data_v2'];

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helpers
const parseISO = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const startOfDay = (d: Date) => {
    const newDate = new Date(d);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

export const AppProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    console.log("AppProvider: Initializing...");

    // MIGRATION FUNCTION
    function migrateState(parsed: any): AppState {
        console.log("Migrating state...", parsed);
        let migrated = { ...parsed };

        try {
            // Migrate to dynamic categories if missing
            if (!migrated.categories || migrated.categories.length === 0) {
                const seed = generateSeedData();
                migrated.categories = seed.categories;
            }

            if (!migrated.projects) {
                migrated.projects = [];
            }

            // Initialize workDates for existing projects
            if (migrated.projects) {
                migrated.projects = migrated.projects.map((p: any) => ({
                    ...p,
                    workDates: p.workDates || []
                }));
            }

            if (!migrated.shields) {
                migrated.shields = {};
                if (migrated.categories) {
                    migrated.categories.forEach((c: CategoryDef) => migrated.shields[c.id] = 2);
                }
            }
            if (!migrated.lastShieldRefill) migrated.lastShieldRefill = format(new Date(), 'yyyy-MM');
            if (!migrated.lastVisitDate) migrated.lastVisitDate = format(new Date(), 'yyyy-MM-dd');
            if (migrated.totalXp === undefined) migrated.totalXp = 0;
            if (migrated.pendingXp === undefined) migrated.pendingXp = 0;

            // Ensure tasks have valid fields (make dateISO optional if missing)
            if (migrated.tasks) {
                migrated.tasks = migrated.tasks.map((t: any) => {
                    // Migration for repeatable boolean -> repeatFrequency
                    let frequency = t.repeatFrequency;
                    if (t.repeatable) {
                        frequency = 'daily';
                    }

                    return {
                        ...t,
                        status: t.status || 'Backlog',
                        dateISO: t.dateISO || undefined,
                        projectId: t.projectId || undefined,
                        repeatFrequency: frequency,
                        repeatable: undefined, // Cleanup old field
                        lastCompletedDateISO: t.lastCompletedDateISO || undefined,
                        streak: t.streak || 0,
                        isPriority: t.isPriority || false
                    };
                });
            }

            // Migrate mini-tasks to array if they are strings
            if (migrated.settings && migrated.settings.defaultMiniTasksByCategory) {
                const miniTasks = migrated.settings.defaultMiniTasksByCategory;
                for (const key in miniTasks) {
                    if (typeof miniTasks[key] === 'string') {
                        const val = miniTasks[key];
                        // Hardcoded check for old defaults to upgrade them
                        if (key === 'Ophthalmology' && val.includes('Read 1 page OR')) miniTasks[key] = DEFAULT_MINI_TASKS['Ophthalmology'];
                        else if (key === 'Research' && val.includes('Write 1 sentence OR')) miniTasks[key] = DEFAULT_MINI_TASKS['Research'];
                        else if (key === 'Physics' && val.includes('Review 1 formula +')) miniTasks[key] = DEFAULT_MINI_TASKS['Physics'];
                        else if (key === 'Clinic & Business' && val.includes('Add 1 clinic idea')) miniTasks[key] = DEFAULT_MINI_TASKS['Clinic & Business'];
                        else if (key === 'Finance' && val.includes('Check balance/portfolio +')) miniTasks[key] = DEFAULT_MINI_TASKS['Finance'];
                        else if (key === 'Admin' && val.includes('Send 1 message/email OR')) miniTasks[key] = DEFAULT_MINI_TASKS['Admin'];
                        else if (key === 'Health' && val.includes('2 min mobility OR')) miniTasks[key] = DEFAULT_MINI_TASKS['Health'];
                        else if (key === 'Family & Baby' && val.includes('5 mins present')) miniTasks[key] = DEFAULT_MINI_TASKS['Family & Baby'];
                        else if (key === 'Languages' && val.includes('5 min Lingoda/')) miniTasks[key] = DEFAULT_MINI_TASKS['Languages'];
                        else if (key === 'Household & Home' && val.includes('10-min reset')) miniTasks[key] = DEFAULT_MINI_TASKS['Household & Home'];
                        else miniTasks[key] = [val];
                    }
                }
            }

            return {
                ...migrated,
                settings: { ...INITIAL_SETTINGS, ...migrated.settings }
            };
        } catch (e) {
            console.error("Error during migration:", e);
            return generateSeedData();
        }
    }

    // State initialization with Migration Logic
    const [state, setState] = useState<AppState>(() => {
        console.log("AppProvider: Running state initializer");
        try {
            // 1. Try current version
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    return migrateState(parsed);
                } catch (e) {
                    console.error("Failed to parse saved state", e);
                }
            }

            // 2. Try legacy keys (Recovery)
            for (const key of LEGACY_KEYS) {
                const legacy = localStorage.getItem(key);
                if (legacy) {
                    try {
                        const parsed = JSON.parse(legacy);
                        console.log(`Recovered data from ${key}`);
                        return migrateState(parsed);
                    } catch (e) {
                        console.error(`Failed to parse legacy ${key}`, e);
                    }
                }
            }

            // 3. Fallback to seed
            console.log("AppProvider: Using seed data");
            return generateSeedData();
        } catch (err) {
            console.error("CRITICAL ERROR in state initializer:", err);
            return generateSeedData();
        }
    });

    const [user, setUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    console.log("AppProvider: Rendered successfully with state", state);

    // Passing partial context to avoid crashes if children try to access it (though they shouldn't)
    const contextValue: any = {
        ...state,
        user,
        notifications,
        addCategory: () => { },
        updateCategoryGoals: () => { },
        renameCategory: () => { },
        deleteCategory: () => { },
        toggleMiniTask: () => { },
        addTask: () => { },
        addTasks: () => { },
        updateTask: () => { },
        deleteTask: () => { },
        toggleTaskDone: () => { },
        toggleTaskPriority: () => { },
        addProject: () => { },
        updateProject: () => { },
        deleteProject: () => { },
        generateAiTasks: async () => { },
        postXpToBank: () => { },
        addLedgerEntry: () => { },
        updateSettings: () => { },
        resetData: () => { },
        buyShield: () => { },
        triggerConfetti: () => { },
        dismissNotification: () => { }
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    return context || {} as AppContextType;
};
