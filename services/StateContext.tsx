
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppContextType, Category, StreakCheckIn, XpTask, RewardLedgerEntry, Settings, Notification, Project, CategoryDef } from '../types';
import { generateSeedData, INITIAL_SETTINGS, COLOR_THEMES, REWARD_COMPLIMENTS, EMOJI_SETS, DEFAULT_MINI_TASKS } from '../constants';
import { format, eachDayOfInterval, addDays, getISOWeek } from 'date-fns';
import { suggestProjectTasks } from './ai';
import { supabase, loadStateFromCloud, saveStateToCloud } from './supabase';
import { User } from '@supabase/supabase-js';

const LOCAL_STORAGE_KEY = 'karin_hq_data_v3';
// Fallback keys to attempt recovery
const LEGACY_KEYS = ['karin_hq_data', 'karin_hq_data_v2'];

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helpers to avoid import issues
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
    });

    const [user, setUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Auth & Cloud Sync
    useEffect(() => {
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
    }, []);

    const loadCloudData = async (userId: string) => {
        try {
            const cloudData = await loadStateFromCloud(userId);
            if (cloudData) {
                // Merge or replace? For now, replace if cloud has data
                // In a real app, you'd want smarter merging
                setState(prev => ({ ...cloudData, settings: { ...prev.settings, ...cloudData.settings } }));
                addNotification("Data synced from cloud");
            }
        } catch (e) {
            console.error("Failed to load cloud data", e);
        }
    };

    // Persistence
    useEffect(() => {
        // Local Save
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));

        // Cloud Save (Debounced ideally, but simple for now)
        if (user) {
            const timeoutId = setTimeout(() => {
                saveStateToCloud(user.id, state).catch(console.error);
            }, 2000); // 2s debounce
            return () => clearTimeout(timeoutId);
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

        if (!migrated.shields) {
            migrated.shields = {};
            migrated.categories.forEach((c: CategoryDef) => migrated.shields[c.id] = 2);
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
                    lastCompletedDateISO: t.lastCompletedDateISO || undefined
                };
            });
        }

        // Migrate mini-tasks to array if they are strings
        if (migrated.settings && migrated.settings.defaultMiniTasksByCategory) {
            const miniTasks = migrated.settings.defaultMiniTasksByCategory;
            for (const key in miniTasks) {
                if (typeof miniTasks[key] === 'string') {
                    // Check if it matches the OLD default for a standard category
                    // If so, update to the NEW default list
                    const oldDefault = DEFAULT_MINI_TASKS[key]; // This is now an array in constants, but we need to check against old string
                    // Actually, simpler: if it's a string, make it an array. 
                    // THEN, if it's a standard category and the array has 1 item which is the old default, replace it?
                    // Let's just say: if it's a string, wrap it.
                    // BUT the user wants the new defaults.
                    // So: if it's a string, AND it matches a known old default string, replace with new default.
                    // Otherwise, just wrap it.

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
    }

    // Persistence Removed (moved up)

    // Logic: Refill Shields & Process Missed Days on Load
    useEffect(() => {
        const checkAndResetTasks = () => {
            const today = new Date();
            const todayISO = format(today, 'yyyy-MM-dd');
            const currentMonth = format(today, 'yyyy-MM');
            const currentWeek = getISOWeek(today);

            setState(prev => {
                let newState = { ...prev };
                let stateChanged = false;

                // 1. Monthly Shield Refill (Additive +5)
                if (newState.lastShieldRefill !== currentMonth) {
                    newState.categories.forEach(c => {
                        newState.shields[c.id] = (newState.shields[c.id] || 0) + 5;
                    });
                    newState.lastShieldRefill = currentMonth;
                    stateChanged = true;
                }

                // 2. Process Missed Days (Auto-consume shields)
                const lastVisit = parseISO(prev.lastVisitDate || todayISO);

                // Only process if last visit was before today
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
                                    // Check if streak was active yesterday (real check-in or shield)
                                    const hasYesterdayCheckIn = newState.streaks.some(s => s.category === cat.id && s.dateISO === yesterdayISO);

                                    // Try to use shield ONLY if streak is active
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
                    if (t.done && t.repeatFrequency) {
                        let shouldReset = false;

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

                        if (shouldReset) {
                            return {
                                ...t,
                                done: false,
                                status: 'Today', // Bring it back to Today/Active
                                dateISO: undefined
                            } as XpTask;
                        }
                    }
                    return t;
                });

                // Check if tasks changed
                if (JSON.stringify(tasksReset) !== JSON.stringify(newState.tasks)) {
                    newState.tasks = tasksReset;
                    stateChanged = true;
                }

                return stateChanged ? newState : prev;
            });
        };

        // Run on mount
        checkAndResetTasks();

        // Run when window gains focus (e.g. user comes back next day)
        const onFocus = () => {
            console.log("App focused, checking for resets...");
            checkAndResetTasks();
        };

        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
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
        const phrase = REWARD_COMPLIMENTS[Math.floor(Math.random() * REWARD_COMPLIMENTS.length)];

        switch (type) {
            case 'streak':
                fireEmojiBurst(EMOJI_SETS.streak);
                fireFloatingText(`${phrase}\nStreak Extended!`);
                break;
            case 'xp':
                // Mix of confetti and emojis
                if (Math.random() > 0.5) fireConfetti();
                else fireEmojiBurst(EMOJI_SETS.xp);
                // Notification handled separately often, but big text is nice
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
    };

    const fireEmojiBurst = (emojis: string[]) => {
        for (let i = 0; i < 20; i++) {
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const el = document.createElement('div');
            el.innerText = emoji;
            el.className = 'fixed pointer-events-none z-[100] text-3xl select-none';
            el.style.left = '50%';
            el.style.top = '60%';
            document.body.appendChild(el);

            // Random physics
            const angle = Math.random() * Math.PI * 2;
            const velocity = 5 + Math.random() * 10;
            const tx = Math.cos(angle) * velocity * 20;
            const ty = Math.sin(angle) * velocity * 20 - 200; // Tend upwards
            const rot = Math.random() * 360;

            el.animate([
                { transform: 'translate(-50%, -50%) scale(0.5) rotate(0deg)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.5) rotate(${rot}deg)`, opacity: 0 }
            ], {
                duration: 1000 + Math.random() * 500,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
            }).onfinish = () => el.remove();
        }
    };

    const fireFloatingText = (text: string) => {
        // Remove existing floating text to prevent overlap
        const existing = document.querySelectorAll('.floating-reward-text');
        existing.forEach(el => el.remove());

        const el = document.createElement('div');
        el.innerText = text;
        el.className = 'floating-reward-text fixed inset-0 flex items-center justify-center pointer-events-none z-[100] text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 drop-shadow-2xl text-center whitespace-pre-line';
        el.style.textShadow = '0 10px 30px rgba(0,0,0,0.2)';
        document.body.appendChild(el);

        el.animate([
            { transform: 'scale(0.5) translateY(50px)', opacity: 0 },
            { transform: 'scale(1.1) translateY(0)', opacity: 1, offset: 0.2 },
            { transform: 'scale(1) translateY(0)', opacity: 1, offset: 0.8 },
            { transform: 'scale(1.2) translateY(-100px)', opacity: 0 }
        ], {
            duration: 2500,
            easing: 'ease-out'
        }).onfinish = () => el.remove();
    };

    const fireConfetti = () => {
        const colors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
        for (let i = 0; i < 60; i++) {
            const div = document.createElement('div');
            div.className = 'fixed w-3 h-3 rounded-sm z-[100]';
            div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            div.style.left = Math.random() * 100 + 'vw';
            div.style.top = '-10px';
            div.style.opacity = '1';
            document.body.appendChild(div);

            const duration = Math.random() * 2 + 1.5;
            div.animate([
                { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                { transform: `translateY(100vh) rotate(${Math.random() * 720}deg)`, opacity: 0 }
            ], {
                duration: duration * 1000,
                easing: 'linear'
            }).onfinish = () => div.remove();
        }
    };

    const triggerConfetti = () => triggerReward('general');

    // --- ACTIONS ---

    const addCategory = (name: string) => {
        const id = name.trim();
        const existing = state.categories.find(c => c.id === id);
        if (existing) {
            addNotification("Category already exists");
            return;
        }
        const newCat: CategoryDef = {
            id,
            name,
            colorTheme: COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)],
            icon: 'Star'
        };

        setState(prev => ({
            ...prev,
            categories: [...prev.categories, newCat],
            shields: { ...prev.shields, [id]: 2 },
            settings: {
                ...prev.settings,
                ...prev.settings.defaultMiniTasksByCategory,
                [id]: ['Do one small thing for this category']
            }
        }));
        addNotification(`Category ${name} created`);
    };

    const renameCategory = (oldId: string, newName: string) => {
        const newId = newName.trim();
        if (oldId === newId) return;
        if (state.categories.find(c => c.id === newId)) {
            alert("Category name already exists");
            return;
        }

        setState(prev => {
            const newCategories = prev.categories.map(c => c.id === oldId ? { ...c, id: newId, name: newName } : c);
            const newTasks = prev.tasks.map(t => t.category === oldId ? { ...t, category: newId } : t);
            const newProjects = prev.projects.map(p => p.category === oldId ? { ...p, category: newId } : p);
            const newStreaks = prev.streaks.map(s => s.category === oldId ? { ...s, category: newId } : s);

            const newShields = { ...prev.shields };
            if (newShields[oldId] !== undefined) {
                newShields[newId] = newShields[oldId];
                delete newShields[oldId];
            }

            const newMiniTasks = { ...prev.settings.defaultMiniTasksByCategory };
            if (newMiniTasks[oldId] !== undefined) {
                newMiniTasks[newId] = newMiniTasks[oldId];
                delete newMiniTasks[oldId];
            }

            return {
                ...prev,
                categories: newCategories,
                tasks: newTasks,
                projects: newProjects,
                streaks: newStreaks,
                shields: newShields,
                settings: {
                    ...prev.settings,
                    defaultMiniTasksByCategory: newMiniTasks
                }
            };
        });
        addNotification("Category renamed successfully");
    };

    const deleteCategory = (id: string) => {
        setState(prev => ({
            ...prev,
            categories: prev.categories.filter(c => c.id !== id),
            tasks: prev.tasks.filter(t => t.category !== id),
            projects: prev.projects.filter(p => p.category !== id),
            streaks: prev.streaks.filter(s => s.category !== id)
        }));
        addNotification("Category deleted");
    };

    const addProject = (project: Omit<Project, 'id' | 'createdAtISO'>) => {
        const newProject: Project = {
            ...project,
            id: Date.now().toString(),
            createdAtISO: new Date().toISOString()
        };
        setState(prev => ({
            ...prev,
            projects: [...prev.projects, newProject]
        }));
        addNotification("Project created!");
    };

    const deleteProject = (id: string) => {
        setState(prev => ({
            ...prev,
            projects: prev.projects.filter(p => p.id !== id),
            tasks: prev.tasks.map(t => t.projectId === id ? { ...t, projectId: undefined } : t)
        }));
        addNotification("Project deleted");
    };

    const generateAiTasks = async (projectId: string, projectTitle: string, category: string) => {
        addNotification("AI is thinking...");
        try {
            const { tasks: suggestedTasks } = await suggestProjectTasks(projectTitle, category);
            if (suggestedTasks && suggestedTasks.length > 0) {
                const newTasks: Omit<XpTask, 'id' | 'done'>[] = suggestedTasks.map(st => ({
                    title: st.title,
                    category,
                    projectId,
                    status: 'Backlog',
                    durationMinutes: st.durationMinutes,
                    xp: st.xp
                }));
                addTasks(newTasks);
            } else {
                addNotification("Could not generate tasks. Try again.");
            }
        } catch (e) {
            console.error(e);
            addNotification("Error generating tasks.");
        }
    };

    const toggleMiniTask = (category: Category, dateISO: string, note?: string) => {
        setState(prev => {
            const existingIndex = prev.streaks.findIndex(s => s.category === category && s.dateISO === dateISO);
            let newStreaks = [...prev.streaks];
            let done = false;

            if (existingIndex >= 0) {
                const existing = newStreaks[existingIndex];
                if (existing.miniTaskDone || existing.isShield) {
                    newStreaks.splice(existingIndex, 1);
                } else {
                    newStreaks[existingIndex] = { ...existing, miniTaskDone: true, source: 'mini', note };
                    done = true;
                }
            } else {
                newStreaks.push({
                    id: Date.now().toString() + Math.random().toString(),
                    category,
                    dateISO,
                    miniTaskDone: true,
                    source: 'mini',
                    note
                });
                done = true;
            }

            if (done) {
                triggerReward('streak');
                addNotification("Mini task complete!");
            }
            return { ...prev, streaks: newStreaks };
        });
    };

    const addTask = (task: Omit<XpTask, 'id' | 'done'>) => {
        setState(prev => ({
            ...prev,
            tasks: [...prev.tasks, { ...task, id: Date.now().toString(), done: false }]
        }));
        addNotification("New Task Added");
    };

    const addTasks = (newTasks: Omit<XpTask, 'id' | 'done'>[]) => {
        const tasksWithIds: XpTask[] = newTasks.map((t, idx) => ({
            ...t,
            id: Date.now().toString() + idx,
            done: false
        }));

        setState(prev => ({
            ...prev,
            tasks: [...prev.tasks, ...tasksWithIds]
        }));
        triggerReward('general');
        addNotification(`Added ${newTasks.length} tasks!`);
    };

    const updateTask = (task: XpTask) => {
        setState(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === task.id ? task : t)
        }));
    };

    const deleteTask = (id: string) => {
        setState(prev => ({
            ...prev,
            tasks: prev.tasks.filter(t => t.id !== id)
        }));
    };

    const toggleTaskDone = (id: string) => {
        setState(prev => {
            const task = prev.tasks.find(t => t.id === id);
            if (!task) return prev;

            const isDone = !task.done;
            const todayISO = format(new Date(), 'yyyy-MM-dd');

            const newTasks = prev.tasks.map(t => {
                if (t.id === id) {
                    if (t.repeatFrequency && isDone) {
                        return {
                            ...t,
                            done: true,
                            status: 'Done',
                            dateISO: todayISO,
                            lastCompletedDateISO: todayISO
                        } as XpTask;
                    }
                    return {
                        ...t,
                        done: isDone,
                        status: isDone ? 'Done' : 'Today',
                        dateISO: isDone ? todayISO : t.dateISO
                    } as XpTask;
                }
                return t;
            });

            let newPendingXp = prev.pendingXp || 0;
            let newTotalXp = prev.totalXp || 0;

            if (isDone) {
                newPendingXp += task.xp;
                newTotalXp += task.xp;
            } else {
                newPendingXp = Math.max(0, newPendingXp - task.xp);
                newTotalXp = Math.max(0, newTotalXp - task.xp);
            }

            let newStreaks = [...prev.streaks];
            if (isDone) {
                const hasCheckIn = newStreaks.some(s => s.category === task.category && s.dateISO === todayISO);

                if (!hasCheckIn) {
                    newStreaks.push({
                        id: `xp-auto-${Date.now()}`,
                        category: task.category,
                        dateISO: todayISO,
                        miniTaskDone: true,
                        source: 'xp',
                        note: `XP Task: ${task.title}`
                    });
                    triggerReward('streak'); // Double reward potential? Let's just do task one to avoid chaos
                }

                // Only trigger XP reward if not already triggering streak? 
                // Actually let's just trigger XP reward, it overrides nicely.
                setTimeout(() => triggerReward('xp'), 100);
                addNotification(`+${task.xp} XP`);
            }

            return { ...prev, tasks: newTasks, streaks: newStreaks, pendingXp: newPendingXp, totalXp: newTotalXp };
        });
    };

    const postXpToBank = () => {
        const todayISO = format(new Date(), 'yyyy-MM-dd');
        const xpToPost = state.pendingXp || 0;

        if (xpToPost <= 0) {
            alert("No pending XP to post.");
            return;
        }

        const euros = xpToPost * state.settings.xpToEuroRate;

        addLedgerEntry({
            dateISO: todayISO,
            type: 'Earn',
            euroAmount: euros,
            source: 'xp_post',
            sourceDateISO: todayISO,
            notes: `XP Earned: ${xpToPost}`
        });

        setState(prev => ({ ...prev, pendingXp: 0 }));
        triggerReward('general');
        addNotification(`Cha-ching! +${euros.toFixed(2)}€ deposited.`);
    };

    const addLedgerEntry = (entry: Omit<RewardLedgerEntry, 'id'>) => {
        setState(prev => ({
            ...prev,
            ledger: [
                { ...entry, id: Date.now().toString() },
                ...prev.ledger
            ]
        }));
    };

    const updateSettings = (settings: Settings) => {
        setState(prev => ({ ...prev, settings }));
        addNotification("Settings saved.");
    };

    const resetData = (newData?: AppState) => {
        if (newData) {
            setState(newData);
        } else {
            setState(generateSeedData());
        }
        addNotification("Data reset complete.");
    }

    const buyShield = (category: Category) => {
        const costXP = 50;
        const costEuro = costXP * state.settings.xpToEuroRate;

        setState(prev => ({
            ...prev,
            shields: {
                ...prev.shields,
                [category]: (prev.shields[category] || 0) + 1
            },
            ledger: [
                {
                    id: Date.now().toString(),
                    dateISO: format(new Date(), 'yyyy-MM-dd'),
                    type: 'Spend',
                    euroAmount: costEuro,
                    source: 'manual',
                    notes: `Bought Streak Shield (50 XP)`
                },
                ...prev.ledger
            ]
        }));
        triggerReward('shield');
    };

    return (
        <AppContext.Provider value={{ ...state, addCategory, renameCategory, deleteCategory, toggleMiniTask, addTask, addTasks, updateTask, deleteTask, toggleTaskDone, addProject, deleteProject, generateAiTasks, postXpToBank, addLedgerEntry, updateSettings, resetData, buyShield, triggerConfetti, notifications, dismissNotification, user }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
};
