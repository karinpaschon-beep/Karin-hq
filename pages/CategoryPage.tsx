
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../services/StateContext';
import { Category, TaskStatus, Project, XpTask } from '../types';
import { Card, Button, Input, Badge, Modal, Select, Textarea, cn } from '../components/ui';
import { format, addDays } from 'date-fns';
import { CheckCircle2, Circle, Plus, Trash2, Clock, Award, Calendar, Shield, Sparkles, TrendingUp, Folder, Zap, Bot, Send, RotateCcw } from 'lucide-react';
import { THEME_STYLES, ICON_MAP, CATEGORY_QUOTES, getQuoteCategory } from '../constants';
import { suggestProjectTasks } from '../services/ai';
import { getISOWeek } from 'date-fns';

interface SuggestedTaskState {
    title: string;
    durationMinutes: number;
    xp: number;
}

export const CategoryPage = () => {
    const { category } = useParams<{ category: string }>();
    const decodedCategory = category ? decodeURIComponent(category) : null;

    const { categories, streaks, tasks, projects, settings, shields, buyShield, toggleMiniTask, addTask, addTasks, updateTask, deleteTask, toggleTaskDone, addProject, deleteProject } = useApp();

    const categoryDef = categories.find(c => c.id === decodedCategory);

    const [activeTab, setActiveTab] = useState<TaskStatus | 'Projects' | 'Tasks'>('Tasks');
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);

    // AI Planner State
    const [showPlannerModal, setShowPlannerModal] = useState(false);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTaskState[]>([]);
    const [aiMessage, setAiMessage] = useState<string>('');
    const [plannerFeedback, setPlannerFeedback] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const [newTask, setNewTask] = useState<{ title: string; xp: number; duration: number; status: TaskStatus; projectId?: string; repeatable: boolean }>({
        title: '', xp: 20, duration: 30, status: 'Today', repeatable: false
    });

    const [newProject, setNewProject] = useState<{ title: string; description: string }>({
        title: '', description: ''
    });

    if (!categoryDef || !decodedCategory) {
        return <div className="p-8 text-center text-slate-500">Category not found</div>;
    }

    const today = new Date();
    const todayISO = format(today, 'yyyy-MM-dd');
    const Icon = ICON_MAP[categoryDef.icon || 'Star'] || ICON_MAP['Star'];
    const style = THEME_STYLES[categoryDef.colorTheme] || THEME_STYLES['slate'];

    // Daily Streak
    const todayCheckIn = streaks.find(s => s.category === decodedCategory && s.dateISO === todayISO);
    const miniTaskDone = !!todayCheckIn?.miniTaskDone;
    const shieldedToday = !!todayCheckIn?.isShield;
    const doneByXp = todayCheckIn?.source === 'xp';

    // Weekly Quote Logic
    const quoteCategory = getQuoteCategory(decodedCategory);
    const quotes = CATEGORY_QUOTES[quoteCategory] || CATEGORY_QUOTES['General'];
    const currentWeek = getISOWeek(today);
    const quoteIndex = currentWeek % quotes.length;
    const weeklyQuote = quotes[quoteIndex];

    const getHistory = () => {
        const history = [];
        for (let i = 6; i >= 0; i--) {
            const date = addDays(today, -i);
            const iso = format(date, 'yyyy-MM-dd');
            const checkIn = streaks.find(s => s.category === decodedCategory && s.dateISO === iso);
            history.push({ date, iso, done: !!checkIn?.miniTaskDone, shield: !!checkIn?.isShield });
        }
        return history;
    };

    const filteredTasks = tasks.filter(t => {
        if (t.category !== decodedCategory) return false;
        if (activeTab === 'Done') return t.status === 'Done';
        if (activeTab === 'Tasks') return t.status !== 'Done';
        return false;
    }).sort((a, b) => {
        // Sort: Repeatable first, then by creation (newest first)
        if (a.repeatable && !b.repeatable) return -1;
        if (!a.repeatable && b.repeatable) return 1;
        return parseInt(b.id) - parseInt(a.id);
    });

    const categoryProjects = projects.filter(p => p.category === decodedCategory);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        addTask({
            title: newTask.title,
            category: decodedCategory,
            xp: newTask.xp,
            durationMinutes: newTask.duration,
            status: newTask.status,
            projectId: newTask.projectId,
            repeatable: newTask.repeatable
        });
        setShowTaskModal(false);
        setNewTask({ title: '', xp: 20, duration: 30, status: 'Today', repeatable: false });
    };

    const handleAddProject = (e: React.FormEvent) => {
        e.preventDefault();
        addProject({
            title: newProject.title,
            description: newProject.description,
            category: decodedCategory,
            status: 'Active'
        });
        setShowProjectModal(false);
        setNewProject({ title: '', description: '' });
    };

    const handleBuyShield = () => {
        const costXP = 50;
        const costEuro = costXP * settings.xpToEuroRate;
        if (confirm(`Buy a Streak Shield for ${costXP} XP equivalent (${costEuro.toFixed(2)}€)?`)) {
            buyShield(decodedCategory);
        }
    };

    const openPlanner = async (project: Project) => {
        setActiveProject(project);
        setShowPlannerModal(true);
        setSuggestedTasks([]);
        setAiMessage("Thinking about tasks for your project...");
        setPlannerFeedback('');
        setIsGenerating(true);

        const response = await suggestProjectTasks(project.title, categoryDef.name);
        setSuggestedTasks(response.tasks);
        setAiMessage(response.message || "Here are some tasks to get you started!");
        setIsGenerating(false);
    };

    const refinePlanner = async () => {
        if (!activeProject || isGenerating) return;
        setIsGenerating(true);

        const response = await suggestProjectTasks(
            activeProject.title,
            categoryDef.name,
            suggestedTasks,
            plannerFeedback
        );

        setSuggestedTasks(response.tasks);
        setAiMessage(response.message || "I've updated the tasks based on your feedback.");
        setPlannerFeedback(''); // clear input
        setIsGenerating(false);
    };

    const savePlannerTasks = () => {
        if (!activeProject) return;

        const tasksToAdd = suggestedTasks.map(st => ({
            title: st.title,
            category: decodedCategory,
            xp: st.xp,
            durationMinutes: st.durationMinutes,
            status: 'Backlog' as TaskStatus,
            projectId: activeProject.id
        }));

        addTasks(tasksToAdd);
        setShowPlannerModal(false);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-2xl shadow-sm transition-transform hover:scale-105", style)}>
                        <Icon size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{categoryDef.name}</h1>
                        <p className="text-slate-500 text-sm italic mt-1 max-w-md">"{weeklyQuote}"</p>
                    </div>
                </div>

                {/* Shield Status */}
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                        <Shield size={16} className="text-slate-400" />
                        <span className="font-bold text-slate-700">{shields[decodedCategory] || 0}</span>
                        <span className="text-xs text-slate-400 uppercase tracking-wide">Shields</span>
                    </div>
                    <button onClick={handleBuyShield} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus size={10} /> Buy Shield (50XP)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: Streak Module */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="p-6 border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <TrendingUp className="text-blue-500" size={20} /> Daily Streak
                        </h2>

                        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm mb-6 transition-all hover:shadow-md">
                            <p className="text-sm text-slate-600 mb-3 font-medium">Daily Mini Task:</p>

                            {miniTaskDone ? (
                                <div className="text-center">
                                    <div className="text-xs text-slate-500 mb-4 h-8 overflow-hidden">
                                        {(settings.defaultMiniTasksByCategory[decodedCategory] || []).length} options available
                                    </div>
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700 shadow-green-200 transition-all duration-300 active:scale-95"
                                        variant="primary"
                                        onClick={() => toggleMiniTask(decodedCategory, todayISO)}
                                    >
                                        <span className="flex items-center gap-2 animate-in zoom-in spin-in-12">
                                            <CheckCircle2 /> {doneByXp ? "Done (XP Task)" : "Done for today"}
                                        </span>
                                    </Button>
                                    <p className="text-xs text-slate-400 mt-2 cursor-pointer hover:text-slate-600" onClick={() => toggleMiniTask(decodedCategory, todayISO)}>
                                        (Click to undo)
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {(settings.defaultMiniTasksByCategory[decodedCategory] || ['Do one small thing']).map((taskOption, idx) => (
                                        <Button
                                            key={idx}
                                            className="w-full justify-start text-left h-auto py-3 px-4 whitespace-normal"
                                            variant="outline"
                                            onClick={() => toggleMiniTask(decodedCategory, todayISO, taskOption)}
                                        >
                                            <span className="flex items-start gap-3">
                                                <Circle className="mt-0.5 flex-shrink-0 text-slate-300" size={18} />
                                                <span className="text-slate-700">{taskOption}</span>
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            )}

                            {shieldedToday && <p className="text-xs text-center text-slate-500 mt-2 flex items-center justify-center gap-1"><Shield size={12} /> Streak maintained by shield</p>}
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Last 7 Days</h3>
                            <div className="flex justify-between items-center">
                                {getHistory().map((day, i) => (
                                    <div key={day.iso} className="flex flex-col items-center gap-1 group">
                                        <span className="text-[10px] text-slate-400 font-medium">{format(day.date, 'EEE')}</span>
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300",
                                            day.done
                                                ? "bg-green-100 border-green-200 text-green-600 group-hover:scale-110"
                                                : day.shield
                                                    ? "bg-slate-100 border-slate-300 text-slate-400"
                                                    : "bg-transparent border-slate-200 text-slate-300"
                                        )}>
                                            {day.done ? <CheckCircle2 size={16} /> : day.shield ? <Shield size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Col: Tasks & Projects */}
                <div className="lg:col-span-2">
                    <Card className="min-h-[500px] flex flex-col border-slate-200 shadow-sm">
                        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between bg-slate-50/50 rounded-t-lg">
                            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
                                {(['Tasks', 'Projects', 'Done'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                                            activeTab === tab ? "bg-white text-slate-800 shadow-sm scale-105" : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            {activeTab === 'Projects' ? (
                                <Button size="sm" onClick={() => setShowProjectModal(true)}>
                                    <Plus size={16} className="mr-1" /> New Project
                                </Button>
                            ) : (
                                <Button size="sm" onClick={() => setShowTaskModal(true)}>
                                    <Plus size={16} className="mr-1" /> New Task
                                </Button>
                            )}
                        </div>

                        <div className="p-0 flex-1 overflow-y-auto">
                            {activeTab === 'Projects' ? (
                                <div className="p-4 space-y-4">
                                    {categoryProjects.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                            <Folder className="mb-2 opacity-50" size={32} />
                                            <p>No projects yet.</p>
                                        </div>
                                    )}
                                    {categoryProjects.map(project => (
                                        <Card key={project.id} className="p-5 border border-slate-200 hover:shadow-md transition-all hover:border-slate-300">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                                        <Folder size={20} className="text-primary" /> {project.title}
                                                    </h3>
                                                    {project.description && <p className="text-sm text-slate-500 mt-1">{project.description}</p>}
                                                </div>
                                                <button
                                                    onClick={() => deleteProject(project.id)}
                                                    className="text-slate-300 hover:text-red-500"
                                                    title="Delete Project"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Linked Tasks Preview */}
                                            <div className="space-y-2 mb-4 pl-4 border-l-2 border-slate-100">
                                                {tasks.filter(t => t.projectId === project.id && !t.done).length === 0 && (
                                                    <p className="text-xs text-slate-400 italic">No active tasks</p>
                                                )}
                                                {tasks.filter(t => t.projectId === project.id && !t.done).slice(0, 3).map(t => (
                                                    <div key={t.id} className="text-sm flex items-center gap-2 text-slate-600">
                                                        <Circle size={12} /> {t.title}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100"
                                                    onClick={() => openPlanner(project)}
                                                >
                                                    <Bot size={14} className="mr-1" />
                                                    Magic Planner
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredTasks.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                            <Sparkles className="mb-2 opacity-50" size={32} />
                                            <p>No tasks in {activeTab}</p>
                                        </div>
                                    )}
                                    {filteredTasks.map(task => (
                                        <div key={task.id} className={cn("p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group", task.done && "bg-slate-50/50")}>
                                            <button
                                                onClick={() => toggleTaskDone(task.id)}
                                                className={cn("flex-shrink-0 transition-all active:scale-90", task.done ? "text-green-500 scale-110" : "text-slate-300 hover:text-green-500")}
                                            >
                                                {task.done ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={cn("font-medium text-slate-800 truncate transition-all", task.done && "line-through text-slate-400")}>{task.title}</h3>
                                                    {task.projectId && (
                                                        <Badge variant="secondary" className="text-[10px] py-0 h-5">
                                                            {projects.find(p => p.id === task.projectId)?.title || "Project"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Clock size={12} /> {task.durationMinutes}m
                                                    </span>
                                                    <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                                                        <Award size={12} /> {task.xp} XP
                                                    </span>
                                                    {task.repeatable && (
                                                        <span className="text-xs text-blue-500 flex items-center gap-1" title="Repeats Daily">
                                                            <RotateCcw size={12} /> Daily
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                                <button
                                                    onClick={() => deleteTask(task.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Task Modal */}
            <Modal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} title="Create XP Task">
                <form onSubmit={handleAddTask} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
                        <Input
                            value={newTask.title}
                            onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                            placeholder="e.g. Write report section"
                            required
                            autoFocus
                        />
                    </div>
                    {/* Optional Project Link */}
                    {categoryProjects.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Link to Project (Optional)</label>
                            <Select
                                value={newTask.projectId || ''}
                                onChange={e => setNewTask({ ...newTask, projectId: e.target.value || undefined })}
                            >
                                <option value="">-- Independent Task --</option>
                                {categoryProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">XP Reward</label>
                            <Input
                                type="number"
                                value={newTask.xp}
                                onChange={e => setNewTask({ ...newTask, xp: parseInt(e.target.value) })}
                                min={5}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (min)</label>
                            <Input
                                type="number"
                                value={newTask.duration}
                                onChange={e => setNewTask({ ...newTask, duration: parseInt(e.target.value) })}
                                min={5}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="repeatable"
                            checked={newTask.repeatable}
                            onChange={e => setNewTask({ ...newTask, repeatable: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="repeatable" className="text-sm font-medium text-slate-700">Repeat Daily</label>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setShowTaskModal(false)}>Cancel</Button>
                        <Button type="submit">Create Task</Button>
                    </div>
                </form>
            </Modal>

            {/* Project Modal */}
            <Modal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title="Start New Project">
                <form onSubmit={handleAddProject} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Project Title</label>
                        <Input
                            value={newProject.title}
                            onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                            placeholder="e.g. Write Research Paper"
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                        <Textarea
                            value={newProject.description}
                            onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                            placeholder="What is the goal of this project?"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setShowProjectModal(false)}>Cancel</Button>
                        <Button type="submit">Create Project</Button>
                    </div>
                </form>
            </Modal>

            {/* AI Planner Modal */}
            <Modal isOpen={showPlannerModal} onClose={() => setShowPlannerModal(false)} title={`Planner: ${activeProject?.title}`} size="lg">
                <div className="flex flex-col h-[60vh]">
                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto space-y-4 p-2">
                        {/* AI Message */}
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <Bot size={18} className="text-indigo-600" />
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-2xl rounded-tl-none text-sm text-slate-800 shadow-sm border border-indigo-100 max-w-[85%]">
                                {isGenerating && !aiMessage ? (
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={16} className="animate-spin text-indigo-500" />
                                        <span>Thinking...</span>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{aiMessage}</p>
                                )}
                            </div>
                        </div>

                        {/* Task List Preview */}
                        {suggestedTasks.length > 0 && (
                            <div className="ml-11 space-y-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Proposed Plan</h4>
                                {suggestedTasks.map((task, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                            <span className="font-medium text-slate-800 text-sm">{task.title}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {task.durationMinutes}m</span>
                                            <span className="flex items-center gap-1 text-amber-600"><Award size={12} /> {task.xp} XP</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-white">
                        <div className="relative">
                            <Textarea
                                value={plannerFeedback}
                                onChange={e => setPlannerFeedback(e.target.value)}
                                placeholder="Reply to AI... e.g., 'Make tasks smaller' or 'Add a review step'"
                                className="pr-12 resize-none"
                                disabled={isGenerating}
                            />
                            <button
                                onClick={refinePlanner}
                                disabled={!plannerFeedback.trim() || isGenerating}
                                className="absolute right-2 bottom-2 p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isGenerating ? <RotateCcw className="animate-spin" size={16} /> : <Send size={16} />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-400">
                                Tasks will be added to <strong>Backlog</strong>.
                            </p>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setShowPlannerModal(false)}>Cancel</Button>
                                <Button
                                    onClick={savePlannerTasks}
                                    disabled={suggestedTasks.length === 0 || isGenerating}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    Save {suggestedTasks.length} Tasks
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
