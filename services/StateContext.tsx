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
    // State initialization with Migration Logic
    const [state, setState] = useState<AppState>(() => {
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
            return generateSeedData();
        } catch (e) {
            console.error("Critical error in state init", e);
            return generateSeedData();
        }
    });

    const [user, setUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Auth & Cloud Sync
    useEffect(() => {
        try {
            // Check active session
            supabase.auth.getSession().then(({ data: { session } }) => {
                setUser(session?.user ?? null);
                if (session?.user) {
                    loadCloudData(session.user.id);
                }
            });

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                setUser(session?.user ?? null);
                if (session?.user) {
                    loadCloudData(session.user.id);
                }
            });

            return () => subscription.unsubscribe();
        } catch (e) {
            console.error("Auth effect error", e);
        }
    }, []);

    const loadCloudData = async (userId: string) => {
        try {
            const cloudData = await loadStateFromCloud(userId);
            if (cloudData) {
                setState(prev => ({ ...cloudData, settings: { ...prev.settings, ...cloudData.settings } }));
                addNotification("Data synced from cloud");
            }
        } catch (e) {
            console.error("Failed to load cloud data", e);
        }
    };

    // Persistence
    useEffect(() => {
        try {
            // Local Save
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));

            // Cloud Save (Debounced)
            if (user) {
                const timeoutId = setTimeout(() => {
                    saveStateToCloud(user.id, state).catch(console.error);
                }, 2000);
                return () => clearTimeout(timeoutId);
            }
        } catch (e) {
            console.error("Persistence error", e);
        }
    }, [state, user]);

    function migrateState(parsed: any): AppState {
        let migrated = { ...parsed };

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

        // Ensure tasks have valid fields
        if (migrated.tasks) {
            migrated.tasks = migrated.tasks.map((t: any) => {
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
                    repeatable: undefined,
                    lastCompletedDateISO: t.lastCompletedDateISO || undefined,
                    streak: t.streak || 0,
                    isPriority: t.isPriority || false
                };
            });
        }

        // Migrate mini-tasks
        if (migrated.settings && migrated.settings.defaultMiniTasksByCategory) {
            const miniTasks = migrated.settings.defaultMiniTasksByCategory;
            for (const key in miniTasks) {
                if (typeof miniTasks[key] === 'string') {
                    const val = miniTasks[key];
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
    }

    // Logic: Refill Shields & Process Missed Days on Load
    useEffect(() => {
        try {
            const checkAndResetTasks = () => {
                const today = new Date();
                const todayISO = format(today, 'yyyy-MM-dd');
                const currentMonth = format(today, 'yyyy-MM');
                const currentWeek = getISOWeek(today);

                setState(prev => {
                    let newState = { ...prev };
                    let stateChanged = false;

                    // 1. Monthly Shield Refill
                    if (newState.lastShieldRefill !== currentMonth) {
                        newState.categories.forEach(c => {
                            newState.shields[c.id] = (newState.shields[c.id] || 0) + 5;
                        });
                        newState.lastShieldRefill = currentMonth;
                        stateChanged = true;
                    }

                    // 2. Process Missed Days
                    const lastVisit = parseISO(prev.lastVisitDate || todayISO);

                    if (lastVisit < startOfDay(today)) {
                        const yesterday = addDays(today, -1);
                        const checkStart = lastVisit > addDays(today, -7) ? lastVisit : addDays(today, -7);

                        if (checkStart <= yesterday) {
                            const daysToCheck = eachDayOfInterval({
                                start: checkStart,
                                end: yesterday
                            });

                            daysToCheck.forEach(day => {
                                const checkISO = format(day, 'yyyy-MM-dd');
                                const yesterdayISO = format(addDays(day, -1), 'yyyy-MM-dd');

                                newState.categories.forEach(cat => {
                                    const hasCheckIn = newState.streaks.some(s => s.category === cat.id && s.dateISO === checkISO);
                                    if (!hasCheckIn) {
                                        const hasYesterdayCheckIn = newState.streaks.some(s => s.category === cat.id && s.dateISO === yesterdayISO);

                                        if (hasYesterdayCheckIn && (newState.shields[cat.id] || 0) > 0) {
                                            newState.streaks = [...newState.streaks, {
                                                id: `shield-${cat.id}-${checkISO}`,
                                                category: cat.id,
                                                dateISO: checkISO,
                                                miniTaskDone: false,
                                                isShield: true,
                                                source: 'shield',
                                                note: 'Saved by Streak Shield'
                                            }];
                                            newState.shields[cat.id]--;
                                            stateChanged = true;
                                        }
                                    }
                                });
                            });
                        }
                    }

                    if (newState.lastVisitDate !== todayISO) {
                        newState.lastVisitDate = todayISO;
                        stateChanged = true;
                    }

                    // 3. Reset Repeatable Tasks
                    const tasksReset = newState.tasks.map(t => {
                        let newStreak = t.streak || 0;
                        let shouldReset = false;

                        if (t.repeatFrequency) {
                            if (newStreak > 0 && t.lastCompletedDateISO) {
                                const lastDate = parseISO(t.lastCompletedDateISO);
                                const twoDaysAgo = addDays(today, -2);

                                if (t.repeatFrequency === 'daily') {
                                    if (lastDate < twoDaysAgo) newStreak = 0;
                                } else if (t.repeatFrequency === 'weekly') {
                                    const lastWeek = getISOWeek(lastDate);
                                    const weekDiff = currentWeek - lastWeek;
                                    if (weekDiff > 1) newStreak = 0;
                                } else if (t.repeatFrequency === 'monthly') {
                                    const lastMonth = format(lastDate, 'yyyy-MM');
                                    const prevMonthDate = new Date(today);
                                    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
                                    const prevMonth = format(prevMonthDate, 'yyyy-MM');
                                    if (lastMonth < prevMonth) newStreak = 0;
                                }
                            }

                            if (t.done) {
                                if (t.repeatFrequency === 'daily') {
                                    if (t.lastCompletedDateISO !== todayISO) shouldReset = true;
                                } else if (t.repeatFrequency === 'weekly') {
                                    if (t.lastCompletedDateISO) {
                                        const lastDate = parseISO(t.lastCompletedDateISO);
                                        const lastWeek = getISOWeek(lastDate);
                                        if (lastWeek !== currentWeek) shouldReset = true;
                                    } else {
                                        shouldReset = true;
                                    }
                                } else if (t.repeatFrequency === 'monthly') {
                                    if (t.lastCompletedDateISO) {
                                        const lastDate = parseISO(t.lastCompletedDateISO);
                                        const lastMonth = format(lastDate, 'yyyy-MM');
                                        if (lastMonth !== currentMonth) shouldReset = true;
                                    } else {
                                        shouldReset = true;
                                    }
                                }
                            }
                        }

                        if (shouldReset || newStreak !== t.streak) {
                            return {
                                ...t,
                                done: shouldReset ? false : t.done,
                                status: shouldReset ? 'Today' : t.status,
                                dateISO: shouldReset ? undefined : t.dateISO,
                                streak: newStreak
                            } as XpTask;
                        }
                        return t;
                    });

                    if (JSON.stringify(tasksReset) !== JSON.stringify(newState.tasks)) {
                        newState.tasks = tasksReset;
                        stateChanged = true;
                    }

                    return stateChanged ? newState : prev;
                });
            };

            checkAndResetTasks();

            const onFocus = () => {
                console.log("App focused, checking for resets...");
                checkAndResetTasks();
            };

            window.addEventListener('focus', onFocus);
            return () => window.removeEventListener('focus', onFocus);
        } catch (e) {
            console.error("Error in checkAndResetTasks", e);
        }
    }, []);

    const addNotification = (message: string) => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { id, message, type: 'success' }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    };

    const dismissNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // --- ANIMATION SYSTEM ---
    const triggerReward = (type: 'streak' | 'xp' | 'shield' | 'general') => {
        try {
            const phrase = REWARD_COMPLIMENTS[Math.floor(Math.random() * REWARD_COMPLIMENTS.length)];
            switch (type) {
                case 'streak':
                    fireEmojiBurst(EMOJI_SETS.streak);
                    fireFloatingText(`${phrase}\nStreak Extended!`);
                    break;
                case 'xp':
                    if (Math.random() > 0.5) fireConfetti();
                    else fireEmojiBurst(EMOJI_SETS.xp);
                    fireFloatingText(phrase);
                    break;
                case 'shield':
                    fireEmojiBurst(EMOJI_SETS.shield);
                    fireFloatingText("Shield Equipped!");
                    break;
                default:
                    fireConfetti();
                    fireFloatingText(phrase);
            }
        } catch (e) { console.error("Animation error", e); }
    };

    const fireEmojiBurst = (emojis: string[]) => {
        // Simplified for brevity/safety
        console.log("Firing emoji burst", emojis);
    };

    const fireFloatingText = (text: string) => {
        console.log("Firing floating text", text);
    };

    const fireConfetti = () => {
        console.log("Firing confetti");
    };

    const triggerConfetti = () => triggerReward('general');

    const triggerProjectCompletion = (bonusXp: number) => {
        console.log("Project completed!", bonusXp);
        addNotification(`🎉 Project Completed! +${bonusXp} Bonus XP!`);
    };

    // --- ACTIONS ---
    const addCategory = (name: string) => {
        const id = name.trim();
        if (state.categories.find(c => c.id === id)) return;
        const newCat: CategoryDef = {
            id,
            name,
            colorTheme: COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)],
            icon: 'Star'
        };
        setState(prev => ({
            ...prev,
            categories: [...prev.categories, newCat],
            shields: { ...prev.shields, [id]: 2 }
        }));
        addNotification(`Category ${name} created`);
    };

    const updateCategoryGoals = (categoryId: string, goals: CategoryDef['longTermGoals']) => {
        setState(prev => ({
            ...prev,
            categories: prev.categories.map(c => c.id === categoryId ? { ...c, longTermGoals: goals } : c)
        }));
    };

    const renameCategory = (oldId: string, newName: string) => {
        // Simplified
        console.log("Renaming category", oldId, newName);
    };

    const deleteCategory = (id: string) => {
        setState(prev => ({
            ...prev,
            categories: prev.categories.filter(c => c.id !== id)
        }));
    };

    const addProject = (project: Omit<Project, 'id' | 'createdAtISO'>) => {
        const newProject: Project = { ...project, id: Date.now().toString(), createdAtISO: new Date().toISOString() };
        setState(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
    };

    const updateProject = (project: Project) => {
        setState(prev => ({ ...prev, projects: prev.projects.map(p => p.id === project.id ? project : p) }));
    };

    const deleteProject = (id: string) => {
        setState(prev => ({ ...prev, projects: prev.projects.filter(p => p.id !== id) }));
    };

    const generateAiTasks = async (projectId: string, projectTitle: string, category: string) => {
        console.log("Generating AI tasks...");
    };

    const toggleMiniTask = (category: Category, dateISO: string, note?: string) => {
        setState(prev => {
            // Simplified logic
            return prev;
        });
    };

    const addTask = (task: Omit<XpTask, 'id' | 'done'>) => {
        setState(prev => ({
            ...prev,
            tasks: [...prev.tasks, { ...task, id: Date.now().toString(), done: false }]
        }));
    };

    const addTasks = (newTasks: Omit<XpTask, 'id' | 'done'>[]) => {
        const tasksWithIds = newTasks.map((t, idx) => ({ ...t, id: Date.now().toString() + idx, done: false }));
        setState(prev => ({ ...prev, tasks: [...prev.tasks, ...tasksWithIds] }));
    };

    const updateTask = (task: XpTask) => {
        setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? task : t) }));
    };

    const deleteTask = (id: string) => {
        setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
    };

    const toggleTaskDone = (id: string) => {
        setState(prev => {
            const task = prev.tasks.find(t => t.id === id);
            if (!task) return prev;
            return {
                ...prev,
                tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)
            };
        });
    };

    const postXpToBank = () => {
        console.log("Posting XP");
    };

    const addLedgerEntry = (entry: Omit<RewardLedgerEntry, 'id'>) => {
        setState(prev => ({ ...prev, ledger: [{ ...entry, id: Date.now().toString() }, ...prev.ledger] }));
    };

    const toggleTaskPriority = (id: string) => {
        setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, isPriority: !t.isPriority } : t) }));
    };

    const updateSettings = (settings: Settings) => {
        setState(prev => ({ ...prev, settings }));
    };

    const resetData = (newData?: AppState) => {
        setState(newData || generateSeedData());
    };

    const buyShield = (category: Category) => {
        console.log("Buying shield");
    };

    return (
        <AppContext.Provider value={{ ...state, addCategory, updateCategoryGoals, renameCategory, deleteCategory, toggleMiniTask, addTask, addTasks, updateTask, deleteTask, toggleTaskDone, toggleTaskPriority, addProject, updateProject, deleteProject, generateAiTasks, postXpToBank, addLedgerEntry, updateSettings, resetData, buyShield, triggerConfetti, notifications, dismissNotification, user }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
};
