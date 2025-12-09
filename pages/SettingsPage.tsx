
import React, { useState, useRef } from 'react';
import { useApp } from '../services/StateContext';
import { Card, Button, Input, Select, Badge, Textarea } from '../components/ui';
import { Category } from '../types';
import { Download, Upload, AlertTriangle, Check, Plus, Trash2, Edit2, Save, X, LogOut, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

export const SettingsPage = () => {
    const { settings, streaks, tasks, ledger, categories, updateSettings, resetData, addCategory, renameCategory, deleteCategory, user } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [newCatName, setNewCatName] = useState('');
    const navigate = useNavigate();

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleExport = () => {
        const data = {
            settings,
            streaks,
            tasks,
            ledger,
            categories, // Include categories
            exportDate: new Date().toISOString(),
            version: 1
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `karin-hq-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                // Basic validation
                if (json.settings && json.tasks && Array.isArray(json.tasks)) {
                    if (confirm("This will overwrite all current data. Are you sure?")) {
                        resetData(json);
                        setSuccessMsg("Data imported successfully!");
                        setTimeout(() => setSuccessMsg(''), 3000);
                    }
                } else {
                    alert("Invalid JSON file format.");
                }
            } catch (err) {
                alert("Failed to parse JSON.");
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const updateMiniTask = (cat: Category, val: string) => {
        updateSettings({
            ...settings,
            defaultMiniTasksByCategory: {
                ...settings.defaultMiniTasksByCategory,
                [cat]: val.split('\n')
            }
        });
    };

    const handleAddCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCatName.trim()) {
            addCategory(newCatName.trim());
            setNewCatName('');
            setSuccessMsg("Category Added");
            setTimeout(() => setSuccessMsg(''), 3000);
        }
    };

    const startEditing = (id: string, currentName: string) => {
        setEditingId(id);
        setEditName(currentName);
    };

    const saveEdit = (oldId: string) => {
        if (editName.trim() && editName.trim() !== oldId) {
            renameCategory(oldId, editName.trim());
        }
        setEditingId(null);
        setEditName('');
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>

            {/* Account Management */}
            <Card className="p-6 space-y-4 border-blue-100 bg-blue-50/50">
                <h2 className="text-xl font-bold text-slate-800 border-b border-blue-200 pb-2 flex items-center gap-2">
                    <User className="text-blue-600" /> Account
                </h2>
                {user ? (
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Logged in as</p>
                            <p className="font-medium text-slate-900">{user.email}</p>
                        </div>
                        <Button variant="outline" onClick={async () => {
                            await supabase.auth.signOut();
                            navigate('/login');
                        }}>
                            <LogOut size={16} className="mr-2" /> Log Out
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-slate-600">Sync your data across devices by logging in.</p>
                        <Button onClick={() => navigate('/login')}>
                            Log In / Sign Up
                        </Button>
                    </div>
                )}
            </Card>

            {successMsg && (
                <div className="p-4 bg-green-100 text-green-700 rounded-md flex items-center gap-2">
                    <Check size={18} /> {successMsg}
                </div>
            )}

            {/* Categories Management */}
            <Card className="p-6 space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Manage Categories</h2>

                <form onSubmit={handleAddCategory} className="flex gap-2">
                    <Input
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        placeholder="New Category Name..."
                        className="max-w-sm"
                    />
                    <Button type="submit"><Plus size={16} className="mr-2" /> Add Category</Button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                            {editingId === cat.id ? (
                                <div className="flex items-center gap-2 flex-1 mr-2">
                                    <Input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="h-8 text-sm"
                                        autoFocus
                                    />
                                    <Button size="icon" className="h-8 w-8 text-green-600 bg-green-50 hover:bg-green-100" onClick={() => saveEdit(cat.id)}>
                                        <Save size={14} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => setEditingId(null)}>
                                        <X size={14} />
                                    </Button>
                                </div>
                            ) : (
                                <span className="font-medium text-slate-700 truncate mr-2">{cat.name}</span>
                            )}

                            {editingId !== cat.id && (
                                <div className="flex items-center gap-1">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => startEditing(cat.id, cat.name)}>
                                        <Edit2 size={14} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => {
                                        if (confirm(`Delete category "${cat.name}" and ALL its data?`)) {
                                            deleteCategory(cat.id);
                                        }
                                    }}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Card>

            {/* Mini Tasks Config */}
            <Card className="p-6 space-y-4">
                <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Default Mini Tasks</h2>
                <div className="space-y-4">
                    {categories.map(cat => (
                        <div key={cat.id}>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{cat.name}</label>
                            <Textarea
                                value={(settings.defaultMiniTasksByCategory[cat.id] || []).join('\n')}
                                onChange={(e) => updateMiniTask(cat.id, e.target.value)}
                                placeholder={`Set default mini tasks for ${cat.name} (one per line)`}
                                className="min-h-[80px]"
                            />
                        </div>
                    ))}
                </div>
            </Card>

            {/* General Config */}
            <Card className="p-6 space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Economy & Logic</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">XP to Euro Rate</label>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400">1 XP = </span>
                            <Input
                                type="number"
                                step="0.01"
                                className="w-24"
                                value={settings.xpToEuroRate}
                                onChange={(e) => updateSettings({ ...settings, xpToEuroRate: parseFloat(e.target.value) })}
                            />
                            <span className="text-slate-400">€</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key (for AI Planner)</label>
                        <Input
                            type="password"
                            value={settings.geminiApiKey || ''}
                            onChange={(e) => updateSettings({ ...settings, geminiApiKey: e.target.value })}
                            placeholder="Enter API Key..."
                        />
                        <p className="text-xs text-slate-400 mt-1">Required for Magic Planner features.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg md:col-span-2">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Spending Gate</label>
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded text-primary focus:ring-primary"
                                checked={settings.spendGateEnabled}
                                onChange={(e) => updateSettings({ ...settings, spendGateEnabled: e.target.checked })}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            If enabled, you must complete a minimum number of daily mini-tasks before adding spending.
                        </p>
                        {settings.spendGateEnabled && (
                            <div className="flex items-center gap-2 text-sm">
                                <span>Require</span>
                                <Input
                                    type="number"
                                    className="w-16 h-8"
                                    value={settings.spendGateThreshold}
                                    onChange={(e) => updateSettings({ ...settings, spendGateThreshold: parseInt(e.target.value) })}
                                />
                                <span>categories done.</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Data Management */}
            <Card className="p-6 space-y-4">
                <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Data Management</h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" onClick={handleExport}>
                        <Download size={16} className="mr-2" /> Export JSON
                    </Button>
                    <div className="relative">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImport}
                            accept=".json"
                            className="hidden"
                        />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            <Upload size={16} className="mr-2" /> Import JSON
                        </Button>
                    </div>
                </div>

                <div className="pt-4 mt-4 border-t border-red-100">
                    <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} /> Danger Zone
                    </h3>
                    <Button variant="danger" size="sm" onClick={() => {
                        if (confirm("Are you sure you want to reset EVERYTHING to default seeds? This cannot be undone.")) {
                            resetData();
                            setSuccessMsg("App reset to factory settings.");
                        }
                    }}>
                        Reset App to Defaults
                    </Button>
                </div>
            </Card>
        </div>
    );
};
