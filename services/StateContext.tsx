
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
    console.log("Dummy AppProvider rendering");
    // We are bypassing the state logic to see if the component itself crashes
    return <AppContext.Provider value={undefined as any}>{children}</AppContext.Provider>;
};

export const useApp = () => {
    const context = useContext(AppContext);
    // if (context === undefined) {
    //     throw new Error('useApp must be used within an AppProvider');
    // }
    return context || {} as AppContextType;
};
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
                    // Calculate Streak
                    let newStreak = t.streak || 0;
                    const lastDate = t.lastCompletedDateISO ? parseISO(t.lastCompletedDateISO) : null;

                    if (!lastDate) {
                        newStreak = 1;
                    } else {
                        if (t.repeatFrequency === 'daily') {
                            const yesterday = addDays(new Date(), -1);
                            const yesterdayISO = format(yesterday, 'yyyy-MM-dd');
                            if (t.lastCompletedDateISO === yesterdayISO) newStreak++;
                            else if (t.lastCompletedDateISO !== todayISO) newStreak = 1; // Reset if gap > 1 day
                        } else if (t.repeatFrequency === 'weekly') {
                            const currentWeek = getISOWeek(new Date());
                            const lastWeek = getISOWeek(lastDate);
                            if (currentWeek === lastWeek + 1) newStreak++;
                            else if (currentWeek > lastWeek + 1) newStreak = 1;
                        } else if (t.repeatFrequency === 'monthly') {
                            const currentMonth = format(new Date(), 'yyyy-MM');
                            const lastMonth = format(lastDate, 'yyyy-MM');
                            // Check if consecutive month (simple string check not enough, need date math)
                            const expectedPrev = format(addDays(new Date(), -30), 'yyyy-MM'); // Approximate
                            // Better:
                            const d = new Date();
                            d.setMonth(d.getMonth() - 1);
                            const prevMonthReal = format(d, 'yyyy-MM');

                            if (lastMonth === prevMonthReal) newStreak++;
                            else if (lastMonth < prevMonthReal) newStreak = 1;
                        }
                    }

                    return {
                        ...t,
                        done: true,
                        status: 'Done',
                        dateISO: todayISO,
                        lastCompletedDateISO: todayISO,
                        streak: newStreak
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

        // Track project work dates
        let newProjects = prev.projects;
        if (isDone && task.projectId) {
            newProjects = prev.projects.map(p => {
                if (p.id === task.projectId) {
                    const workDates = p.workDates || [];
                    if (!workDates.includes(todayISO)) {
                        return { ...p, workDates: [...workDates, todayISO] };
                    }
                }
                return p;
            });
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

            // Check for project completion
            if (task.projectId) {
                const projectTasks = newTasks.filter(t => t.projectId === task.projectId);
                const allDone = projectTasks.every(t => t.done);
                const project = newProjects.find(p => p.id === task.projectId);

                if (allDone && project && project.status !== 'Completed') {
                    // Calculate bonus XP (20% of total project XP or 100, whichever is higher)
                    const totalProjectXp = projectTasks.reduce((sum, t) => sum + t.xp, 0);
                    const bonusXp = Math.max(100, Math.floor(totalProjectXp * 0.2));

                    // Award bonus XP
                    newPendingXp += bonusXp;
                    newTotalXp += bonusXp;

                    // Mark project as completed
                    newProjects = newProjects.map(p =>
                        p.id === task.projectId ? { ...p, status: 'Completed' as const } : p
                    );

                    // Trigger epic celebration
                    setTimeout(() => {
                        triggerProjectCompletion(bonusXp);
                        addNotification(`🎉 Project Completed! +${bonusXp} Bonus XP!`);
                    }, 300);
                }
            }
        }

        return { ...prev, tasks: newTasks, streaks: newStreaks, pendingXp: newPendingXp, totalXp: newTotalXp, projects: newProjects };
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

const toggleTaskPriority = (id: string) => {
    setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
            t.id === id ? { ...t, isPriority: !t.isPriority } : t
        )
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
