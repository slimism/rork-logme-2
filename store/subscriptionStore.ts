import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TokenState {
  tokens: number;
  trialLogsUsed: number;
  trialCompleted: boolean;
  trialProjectId: string | null;
  unlockedProjects: string[];
  addTokens: (count: number) => void;
  useToken: () => boolean;
  consumeTokenForProject: (projectId: string) => boolean;
  useTrial: () => boolean;
  canCreateProject: () => boolean;
  canAddLog: (projectId: string) => boolean;
  getRemainingTrialLogs: () => number;
  isProjectUnlocked: (projectId: string) => boolean;
  isTrialProject: (projectId: string) => boolean;
  getProjectLogCount: (projectId: string, logSheets: any[]) => number;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      tokens: 0,
      trialLogsUsed: 0,
      trialCompleted: false,
      trialProjectId: null,
      unlockedProjects: [],
      
      addTokens: (count: number) => {
        set((state) => ({ tokens: state.tokens + count }));
      },
      
      useToken: () => {
        const state = get();
        if (state.tokens > 0) {
          set({ tokens: state.tokens - 1 });
          return true;
        }
        return false;
      },
      
      consumeTokenForProject: (projectId: string) => {
        const state = get();
        if (state.tokens > 0 && !state.unlockedProjects.includes(projectId)) {
          set({ 
            tokens: state.tokens - 1,
            unlockedProjects: [...state.unlockedProjects, projectId]
          });
          return true;
        }
        return false;
      },
      
      useTrial: () => {
        const state = get();
        if (!state.trialCompleted && state.trialLogsUsed < 15) {
          set({ trialLogsUsed: state.trialLogsUsed + 1 });
          return true;
        }
        return false;
      },
      
      canCreateProject: () => {
        const state = get();
        return state.tokens > 0 || state.trialProjectId === null;
      },
      
      canAddLog: (projectId: string) => {
        const state = get();
        if (state.unlockedProjects.includes(projectId)) {
          return true;
        }
        if (state.trialProjectId === projectId && state.trialLogsUsed < 15) {
          return true;
        }
        return false;
      },
      
      getRemainingTrialLogs: () => {
        const state = get();
        if (state.trialProjectId === null) return 15;
        return Math.max(0, 15 - state.trialLogsUsed);
      },
      
      isProjectUnlocked: (projectId: string) => {
        const state = get();
        return state.unlockedProjects.includes(projectId);
      },
      
      isTrialProject: (projectId: string) => {
        const state = get();
        return state.trialProjectId === projectId;
      },
      
      getProjectLogCount: (projectId: string, logSheets: any[]) => {
        return logSheets.filter(sheet => sheet.projectId === projectId).length;
      },
    }),
    {
      name: 'token-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Keep the old store for backward compatibility during transition
interface SubscriptionState {
  isPro: boolean;
  purchaseDate?: string;
  trialUsed: boolean;
  setPro: (isPro: boolean, purchaseDate?: string) => void;
  setTrialUsed: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      isPro: false,
      purchaseDate: undefined,
      trialUsed: false,
      
      setPro: (isPro: boolean, purchaseDate?: string) => {
        set({ isPro, purchaseDate });
      },
      
      setTrialUsed: () => {
        set({ trialUsed: true });
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);