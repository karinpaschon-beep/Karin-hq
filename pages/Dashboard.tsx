
import React, { useState, useEffect } from 'react';
import { useApp } from '../services/StateContext';
import { format, addDays } from 'date-fns';
import { Category } from '../types';
import { QUOTES, THEME_STYLES, ICON_MAP } from '../constants';
import { Card, Button, Badge, Modal, Input, cn } from '../components/ui';
import { CheckCircle2, Circle, TrendingUp, Coins, PiggyBank, ArrowRight, Wallet, Shield, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { categories, streaks, tasks, ledger, settings, shields, toggleMiniTask, postXpToBank, addLedgerEntry } = useApp();
  const [spendModalOpen, setSpendModalOpen] = useState(false);
  const [spendAmount, setSpendAmount] = useState('');
  const [spendNote, setSpendNote] = useState('');
  const [quote, setQuote] = useState('');

  const today = new Date();
  const todayISO = format(today, 'yyyy-MM-dd');

  useEffect(() => {
    // Seed quote based on day of month to be consistent for the day
    const dayIndex = today.getDate() % QUOTES.length;
    setQuote(QUOTES[dayIndex]);
  }, []);

  // Streak Logic
  const getStreakCount = (cat: Category) => {
    let count = 0;
    let currentCheckDate = today;
    
    // Check if done today (or shielded today)
    const doneToday = streaks.some(s => s.category === cat && s.dateISO === todayISO && (s.miniTaskDone || s.isShield));
    if (!doneToday) {
        currentCheckDate = addDays(today, -1);
    }

    while (true) {
        const checkISO = format(currentCheckDate, 'yyyy-MM-dd');
        const entry = streaks.find(s => s.category === cat && s.dateISO === checkISO);
        if (entry && (entry.miniTaskDone || entry.isShield)) {
            count++;
            currentCheckDate = addDays(currentCheckDate, -1);
        } else {
            break;
        }
    }
    return count;
  };

  // XP Logic
  const xpTasksToday = tasks.filter(t => t.status === 'Today' && !t.done);
  const xpEarnedToday = tasks
    .filter(t => t.done && t.status === 'Done' && t.dateISO === todayISO)
    .reduce((sum, t) => sum + t.xp, 0);

  // Bank Logic
  const balance = ledger.reduce((acc, curr) => acc + (curr.type === 'Earn' ? curr.euroAmount : -curr.euroAmount), 0);
  const postedToday = ledger.some(l => l.source === 'xp_post' && l.sourceDateISO === todayISO);
  
  // Spend Gate Logic
  const categoriesDoneTodayCount = categories.filter(cat => 
    streaks.some(s => s.category === cat.id && s.dateISO === todayISO && s.miniTaskDone)
  ).length;
  
  const canSpend = !settings.spendGateEnabled || categoriesDoneTodayCount >= settings.spendGateThreshold;

  const handleSpend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spendAmount) return;
    addLedgerEntry({
        dateISO: todayISO,
        type: 'Spend',
        euroAmount: parseFloat(spendAmount),
        source: 'manual',
        notes: spendNote
    });
    setSpendModalOpen(false);
    setSpendAmount('');
    setSpendNote('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white shadow-lg group">
        <div className="relative z-10 transition-transform duration-500 group-hover:scale-[1.01]">
            <h1 className="text-3xl font-bold mb-2">Welcome Back!</h1>
            <p className="text-violet-100 text-lg italic max-w-2xl opacity-90">"{quote}"</p>
            <p className="text-xs text-violet-300 mt-4 uppercase tracking-widest font-semibold">{format(today, 'EEEE, MMMM do')}</p>
        </div>
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10 group-hover:rotate-12 transition-transform duration-700">
            <Sparkles size={200} />
        </div>
      </header>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white/80 backdrop-blur border-blue-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shadow-inner">
                <TrendingUp size={28} />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Daily Habits</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">{categoriesDoneTodayCount}</span>
                    <span className="text-sm text-slate-400">/ {categories.length}</span>
                </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white/80 backdrop-blur border-amber-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
           <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl shadow-inner">
                <Coins size={28} />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">XP Today</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">{xpEarnedToday}</span>
                    <span className="text-sm text-slate-400">XP</span>
                </div>
                <div className="text-xs text-amber-600 font-medium mt-1">
                    ≈ {(xpEarnedToday * settings.xpToEuroRate).toFixed(2)}€
                </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white/80 backdrop-blur border-emerald-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
           <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl shadow-inner">
                <PiggyBank size={28} />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Bank Balance</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">{balance.toFixed(2)}€</span>
                </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Streaks */}
        <div className="lg:col-span-2 space-y-8">
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Sparkles className="text-yellow-500" size={20} />
                    Today's Streaks
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map(cat => {
                        const checkIn = streaks.find(s => s.category === cat.id && s.dateISO === todayISO);
                        const isDone = !!checkIn?.miniTaskDone;
                        const isShielded = !!checkIn?.isShield;
                        const streak = getStreakCount(cat.id);
                        const Icon = ICON_MAP[cat.icon || 'Star'] || ICON_MAP['Star'];
                        const style = THEME_STYLES[cat.colorTheme] || THEME_STYLES['slate'];
                        const shieldCount = shields[cat.id] || 0;

                        return (
                            <Card key={cat.id} className={cn("relative overflow-hidden transition-all duration-300 hover:scale-[1.02]", isDone ? "bg-white border-green-200 shadow-sm" : "bg-slate-50 border-transparent")}>
                                <div className={cn("absolute top-0 left-0 w-1 h-full transition-colors", isDone ? "bg-green-500" : "bg-slate-200")}></div>
                                <div className="p-4 pl-6">
                                    <div className="flex justify-between items-start mb-3">
                                        <Link to={`/category/${encodeURIComponent(cat.id)}`} className="flex items-center gap-2 group">
                                            <div className={cn("p-2 rounded-lg transition-colors shadow-sm", style)}>
                                                <Icon size={18} />
                                            </div>
                                            <span className="font-bold text-slate-700 group-hover:text-primary transition-colors">{cat.name}</span>
                                        </Link>
                                        <div className="flex flex-col items-end">
                                            <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-1 transition-colors", isDone ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
                                                <TrendingUp size={12} className={isDone ? "text-green-600" : "text-orange-500"} /> {streak} day{streak !== 1 && 's'}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400" title="Streak Shields Available">
                                                <Shield size={10} /> {shieldCount}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <p className="text-xs text-slate-500 mb-4 line-clamp-2 h-8 leading-relaxed">
                                        {settings.defaultMiniTasksByCategory[cat.id] || "No mini-task set"}
                                    </p>
                                    
                                    <Button 
                                        size="sm" 
                                        variant={isDone ? "secondary" : "outline"} 
                                        className={cn("w-full justify-between group transition-all active:scale-95", isDone && "bg-green-50 text-green-700 border-green-200 hover:bg-green-100")}
                                        onClick={() => toggleMiniTask(cat.id, todayISO)}
                                    >
                                        <span className="flex items-center gap-2">
                                            {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                            {isDone ? "Done!" : "Mark Done"}
                                        </span>
                                        {isShielded && <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600">Shielded</span>}
                                    </Button>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

            <div className="pt-2">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Today's XP Tasks</h2>
                {xpTasksToday.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500">
                        <CheckCircle2 size={48} className="text-slate-300 mb-2" />
                        <p>All clear for today!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {xpTasksToday.map(task => {
                             const cat = categories.find(c => c.id === task.category);
                             const Icon = cat ? (ICON_MAP[cat.icon || 'Star'] || ICON_MAP['Star']) : ICON_MAP['Star'];
                             const style = cat ? THEME_STYLES[cat.colorTheme] : THEME_STYLES['slate'];
                             
                             return (
                             <Card key={task.id} className="p-4 flex items-center justify-between group hover:shadow-md transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary hover:bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                     <div className={cn("p-2 rounded-lg hidden sm:block", style)}>
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="secondary" className="text-[10px]">{cat?.name || task.category}</Badge>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <TrendingUp size={10} /> {task.durationMinutes} min
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-slate-800">{task.title}</h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <span className="font-bold text-amber-500 block">+{task.xp} XP</span>
                                    </div>
                                    <Button size="icon" variant="ghost" asChild className="text-slate-400 hover:text-primary">
                                        <Link to={`/category/${encodeURIComponent(task.category)}`}><ArrowRight size={20} /></Link>
                                    </Button>
                                </div>
                             </Card>
                        )})}
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Bank Actions */}
        <div className="space-y-6">
            <Card className="p-6 sticky top-6 border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Wallet size={20} className="text-emerald-600" /> Bank Actions
                </h2>
                
                <div className="space-y-4">
                    <div className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100 shadow-inner">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-500">Unposted XP:</span>
                            <span className="font-bold text-slate-800">{xpEarnedToday}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-4">
                            <span className="text-slate-500">Value:</span>
                            <span className="font-bold text-emerald-600 text-lg">+{(xpEarnedToday * settings.xpToEuroRate).toFixed(2)}€</span>
                        </div>
                        <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 active:scale-95 transition-transform" 
                            disabled={xpEarnedToday === 0 || postedToday}
                            onClick={postXpToBank}
                        >
                            {postedToday ? "Already Posted ✅" : "Post to Bank"}
                        </Button>
                        {postedToday && <p className="text-xs text-center text-slate-400 mt-2">Come back tomorrow!</p>}
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                         <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-700">Recent</h3>
                            <span className="text-xs text-slate-400">Last 5</span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {ledger.slice(0, 5).map(entry => (
                                <div key={entry.id} className="flex justify-between items-center text-sm p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-700">{entry.notes || (entry.type === 'Earn' ? 'XP Deposit' : 'Spending')}</span>
                                        <span className="text-[10px] text-slate-400">{entry.dateISO}</span>
                                    </div>
                                    <span className={cn("font-bold", entry.type === 'Earn' ? "text-emerald-600" : "text-rose-600")}>
                                        {entry.type === 'Earn' ? '+' : '-'}{entry.euroAmount.toFixed(2)}€
                                    </span>
                                </div>
                            ))}
                            {ledger.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No transactions yet.</p>}
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button 
                            variant="secondary" 
                            className="w-full border-dashed"
                            onClick={() => setSpendModalOpen(true)}
                        >
                            Record Expense
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
      </div>

      <Modal isOpen={spendModalOpen} onClose={() => setSpendModalOpen(false)} title="Record Spending">
        {!canSpend ? (
            <div className="space-y-6 text-center py-6">
                <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Shield size={40} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Gate Locked</h3>
                    <p className="text-slate-600 text-sm mt-2 px-6">
                        Complete at least <strong>{settings.spendGateThreshold}</strong> mini tasks today to unlock spending. 
                        <br/>Progress: <span className="font-bold text-primary">{categoriesDoneTodayCount} / {settings.spendGateThreshold}</span>
                    </p>
                </div>
                <div className="pt-2">
                    <Button variant="outline" onClick={() => setSpendModalOpen(false)}>Close</Button>
                </div>
            </div>
        ) : (
            <form onSubmit={handleSpend} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (€)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400">€</span>
                        <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            className="pl-8 text-lg"
                            placeholder="0.00" 
                            value={spendAmount} 
                            onChange={e => setSpendAmount(e.target.value)} 
                            required
                            autoFocus
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <Input 
                        type="text" 
                        placeholder="What did you buy?" 
                        value={spendNote} 
                        onChange={e => setSpendNote(e.target.value)} 
                    />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setSpendModalOpen(false)}>Cancel</Button>
                    <Button type="submit" variant="danger">Confirm Spend</Button>
                </div>
            </form>
        )}
      </Modal>
    </div>
  );
};
