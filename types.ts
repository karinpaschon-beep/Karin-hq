
export type Category = string;

export interface CategoryDef {
  id: string;
  name: string;
  icon?: string; // Icon name from Lucide
  colorTheme: string; // key of CATEGORY_STYLES
  backgroundImage?: string; // Path to background image
}

export interface StreakCheckIn {
  id: string;
  dateISO: string; // YYYY-MM-DD
  category: Category;
  miniTaskDone: boolean;
  note?: string;
  isShield?: boolean;
  source?: 'mini' | 'xp' | 'shield';
}

export type TaskStatus = 'Backlog' | 'This Week' | 'Today' | 'Done';

export interface Project {
  id: string;
  title: string;
  description?: string;
  category: Category;
  status: 'Active' | 'Completed' | 'On Hold';
  createdAtISO: string;
}

export interface XpTask {
  id: string;
  title: string;
  category: Category;
  projectId?: string;
  status: TaskStatus;
  durationMinutes: number;
  xp: number;
  done: boolean;
  dateISO?: string; // Optional: Only set when Done, or if specifically scheduled
  notes?: string;
  repeatFrequency?: 'daily' | 'weekly' | 'monthly'; // Changed from repeatable?: booleang;
}

export type LedgerSource = 'xp_post' | 'manual';

export interface RewardLedgerEntry {
  id: string;
  dateISO: string;
  type: 'Earn' | 'Spend';
  euroAmount: number;
  notes?: string;
  source: LedgerSource;
  sourceDateISO?: string; // If source is xp_post, which day's XP was it?
}

export interface Settings {
  xpToEuroRate: number;
  spendGateEnabled: boolean;
  spendGateThreshold: number;
  defaultMiniTasksByCategory: Record<Category, string[]>;
  geminiApiKey?: string;
}

export interface AppState {
  categories: CategoryDef[];
  streaks: StreakCheckIn[];
  tasks: XpTask[];
  projects: Project[];
  ledger: RewardLedgerEntry[];
  settings: Settings;
  shields: Record<Category, number>;
  lastShieldRefill: string; // yyyy-MM
  lastVisitDate: string; // yyyy-MM-dd
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info';
}

export interface AppContextType extends AppState {
  addCategory: (name: string) => void;
  renameCategory: (oldId: string, newName: string) => void;
  deleteCategory: (id: string) => void;
  toggleMiniTask: (category: Category, dateISO: string, note?: string) => void;
  addTask: (task: Omit<XpTask, 'id' | 'done'>) => void;
  addTasks: (tasks: Omit<XpTask, 'id' | 'done'>[]) => void;
  addProject: (project: Omit<Project, 'id' | 'createdAtISO'>) => void;
  deleteProject: (id: string) => void;
  generateAiTasks: (projectId: string, projectTitle: string, category: string) => Promise<void>;
  updateTask: (task: XpTask) => void;
  deleteTask: (id: string) => void;
  toggleTaskDone: (id: string) => void;
  postXpToBank: () => void;
  addLedgerEntry: (entry: Omit<RewardLedgerEntry, 'id'>) => void;
  updateSettings: (settings: Settings) => void;
  resetData: (newData?: AppState) => void;
  buyShield: (category: Category) => void;
  triggerConfetti: () => void;
  notifications: Notification[];
  dismissNotification: (id: string) => void;
  user: any | null; // Using any to avoid direct dependency on supabase-js in types for now
}
