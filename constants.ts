
import { AppState, CategoryDef } from './types';
import { format } from 'date-fns';
import {
  Eye, BookOpen, Atom, Briefcase, TrendingUp,
  FileText, Heart, Baby, Languages, Home,
  Star, Music, Code, PenTool, Coffee, Zap
} from 'lucide-react';

// Icon Map for dynamic lookup
export const ICON_MAP: Record<string, any> = {
  Eye, BookOpen, Atom, Briefcase, TrendingUp,
  FileText, Heart, Baby, Languages, Home,
  Star, Music, Code, PenTool, Coffee, Zap
};

// Available color themes
export const COLOR_THEMES = [
  'blue', 'purple', 'indigo', 'teal', 'emerald', 'slate', 'rose', 'orange', 'pink', 'cyan', 'amber', 'lime'
];

export const THEME_STYLES: Record<string, string> = {
  'blue': 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  'purple': 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  'indigo': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  'teal': 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
  'emerald': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  'slate': 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
  'rose': 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  'orange': 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  'pink': 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
  'cyan': 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
  'amber': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  'lime': 'bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100',
};

export const QUOTES = [
  "Small steps every day lead to giant leaps over time.",
  "Consistency is what transforms average into excellence.",
  "You don't have to be great to start, but you have to start to be great.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "The secret of your future is hidden in your daily routine.",
  "Don't watch the clock; do what it does. Keep going.",
  "Energy flows where intention goes.",
  "Your only limit is your mind.",
  "Dream big. Start small. Act now.",
  "Discipline is choosing between what you want now and what you want most."
];

export const REWARD_COMPLIMENTS = [
  "Unstoppable!",
  "Crushing It!",
  "On Fire!",
  "Magnificent!",
  "Spectacular!",
  "Legendary!",
  "Divine!",
  "Excellent!",
  "Bravo!",
  "Keep it up!",
  "Momentum!",
  "Victory!"
];

export const EMOJI_SETS = {
  streak: ['🔥', '⚡', '🚀', '🧨', '🎆'],
  xp: ['💎', '✨', '🌟', '💰', '🔮', '🧬'],
  shield: ['🛡️', '💪', '🧱', '🏰'],
  party: ['🎉', '🎊', '🎈', '🥳']
};

export const DEFAULT_MINI_TASKS: Record<string, string> = {
  'Ophthalmology': 'Read 1 page OR write 3 bullets from oculoplastics/cataract',
  'Research': 'Write 1 sentence OR fix 1 reference',
  'Physics': 'Review 1 formula + 1 worked mini-step',
  'Clinic & Business': 'Add 1 clinic idea (service/workflow/pricing/tech)',
  'Finance': 'Check balance/portfolio + write 1 next-step line',
  'Admin': 'Send 1 message/email OR file 1 document',
  'Health': '2 min mobility OR 10 squats + stretch',
  'Family & Baby': '5 mins present (no phone) + memory note',
  'Languages': '5 min Lingoda/Écoute/French page',
  'Household & Home': '10-min reset (one surface/drawer/laundry)',
};

export const INITIAL_SETTINGS = {
  xpToEuroRate: 1,
  spendGateEnabled: true,
  spendGateThreshold: 5,
  defaultMiniTasksByCategory: DEFAULT_MINI_TASKS,
};

// Initial Categories for Seed
const INITIAL_CATEGORIES: CategoryDef[] = [
  { id: 'Ophthalmology', name: 'Ophthalmology', icon: 'Eye', colorTheme: 'blue', backgroundImage: '/bg-science.png' },
  { id: 'Research', name: 'Research', icon: 'BookOpen', colorTheme: 'purple', backgroundImage: '/bg-science.png' },
  { id: 'Physics', name: 'Physics', icon: 'Atom', colorTheme: 'indigo', backgroundImage: '/bg-science.png' },
  { id: 'Clinic & Business', name: 'Clinic & Business', icon: 'Briefcase', colorTheme: 'teal', backgroundImage: '/bg-office.png' },
  { id: 'Finance', name: 'Finance', icon: 'TrendingUp', colorTheme: 'emerald', backgroundImage: '/bg-office.png' },
  { id: 'Admin', name: 'Admin', icon: 'FileText', colorTheme: 'slate', backgroundImage: '/bg-office.png' },
  { id: 'Health', name: 'Health', icon: 'Heart', colorTheme: 'rose', backgroundImage: '/bg-home.png' },
  { id: 'Family & Baby', name: 'Family & Baby', icon: 'Baby', colorTheme: 'orange', backgroundImage: '/bg-home.png' },
  { id: 'Languages', name: 'Languages', icon: 'Languages', colorTheme: 'pink', backgroundImage: '/bg-home.png' },
  { id: 'Household & Home', name: 'Household & Home', icon: 'Home', colorTheme: 'cyan', backgroundImage: '/bg-home.png' },
];

// Seed generator function
export const generateSeedData = (): AppState => {
  const today = new Date();
  const todayISO = format(today, 'yyyy-MM-dd');
  const currentMonth = format(today, 'yyyy-MM');

  // Initialize shields
  const initialShields: Record<string, number> = {};
  INITIAL_CATEGORIES.forEach(c => initialShields[c.id] = 2);

  return {
    categories: INITIAL_CATEGORIES,
    projects: [],
    streaks: [],
    ledger: [],
    settings: INITIAL_SETTINGS,
    shields: initialShields,
    lastShieldRefill: currentMonth,
    lastVisitDate: todayISO,
    tasks: [
      { id: '1', category: 'Languages', title: 'Lingoda lesson (10:00)', durationMinutes: 50, xp: 25, status: 'Today', done: false, dateISO: todayISO },
      { id: '2', category: 'Languages', title: 'Lingoda revision', durationMinutes: 20, xp: 10, status: 'Today', done: false, dateISO: todayISO },
      { id: '3', category: 'Household & Home', title: 'Tidy bedroom + start bedsheets wash', durationMinutes: 30, xp: 15, status: 'This Week', done: false, dateISO: todayISO },
      { id: '4', category: 'Household & Home', title: 'Christmas tree', durationMinutes: 60, xp: 25, status: 'Backlog', done: false, dateISO: todayISO },
      { id: '5', category: 'Household & Home', title: 'Cookies', durationMinutes: 45, xp: 20, status: 'Backlog', done: false, dateISO: todayISO },
      { id: '6', category: 'Household & Home', title: 'Curtain poles', durationMinutes: 30, xp: 15, status: 'Backlog', done: false, dateISO: todayISO },
      { id: '7', category: 'Admin', title: 'Theo docs', durationMinutes: 30, xp: 15, status: 'Today', done: false, dateISO: todayISO },
      { id: '8', category: 'Admin', title: 'Email Hanusch + organise cookies & Punsch', durationMinutes: 25, xp: 10, status: 'Today', done: false, dateISO: todayISO },
      { id: '9', category: 'Admin', title: 'Text Claire', durationMinutes: 10, xp: 5, status: 'Today', done: false, dateISO: todayISO },
      { id: '10', category: 'Admin', title: 'Text Aleks', durationMinutes: 10, xp: 5, status: 'Today', done: false, dateISO: todayISO },
      { id: '11', category: 'Physics', title: 'Atom/Kern/Teilchen block', durationMinutes: 45, xp: 20, status: 'Today', done: false, dateISO: todayISO },
      { id: '12', category: 'Research', title: 'Statistics paper block', durationMinutes: 45, xp: 20, status: 'Today', done: false, dateISO: todayISO },
      { id: '13', category: 'Health', title: 'Workout', durationMinutes: 15, xp: 10, status: 'Today', done: false, dateISO: todayISO },
      { id: '14', category: 'Ophthalmology', title: 'Optional deep block', durationMinutes: 45, xp: 20, status: 'This Week', done: false, dateISO: todayISO },
    ],
  };
};
