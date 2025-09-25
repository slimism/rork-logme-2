import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TokenState {
  tokens: number;
  trialLogsUsed: number;
  trialCompleted: boolean;
  trialProjectId: string | null; // Track which project is using trial
  addTokens: (count: number) => void;
  useToken: () => boolean;
  useTrial: (projectId: string) => boolean;
  canCreateProject: () => boolean;
  canAddLog: (projectId: string) => boolean;
  getRemainingTrialLogs: () => number;
  resetTrial: () => void; // Reset trial when project is deleted
  assignTokenToProject: (projectId: string) => boolean; // Assign token to existing project
  getProjectLogCount: (projectId: string) => number;
  setProjectLogCount: (projectId: string, count: number) => void;
  projectLogCounts: { [projectId: string]: number }; // Track logs per project
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      tokens: 0,
      trialLogsUsed: 0,
      trialCompleted: false,
      trialProjectId: null,
      projectLogCounts: {},
      
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
      
      useTrial: (projectId: string) => {
        const state = get();
        // Can only use trial if not completed and either no trial project or same project
        if (!state.trialCompleted && (state.trialProjectId === null || state.trialProjectId === projectId)) {
          const newLogsUsed = state.trialLogsUsed + 1;
          const isCompleted = newLogsUsed >= 15;
          
          set({ 
            trialLogsUsed: newLogsUsed,
            trialCompleted: isCompleted,
            trialProjectId: projectId,
            projectLogCounts: {
              ...state.projectLogCounts,
              [projectId]: (state.projectLogCounts[projectId] || 0) + 1
            }
          });
          return true;
        }
        return false;
      },
      
      canCreateProject: () => {
        const state = get();
        // Can create if has tokens OR trial not completed and no trial project exists
        return state.tokens > 0 || (!state.trialCompleted && state.trialProjectId === null);
      },
      
      canAddLog: (projectId: string) => {
        const state = get();
        const projectLogCount = state.projectLogCounts[projectId] || 0;
        
        // If project has unlimited logs (token was used), always allow
        if (projectLogCount === -1) {
          return true;
        }
        
        // If has tokens, can add to any project
        if (state.tokens > 0) {
          return true;
        }
        
        // For trial: can add if trial not completed and this is the trial project and under 15 logs
        if (!state.trialCompleted && state.trialProjectId === projectId && state.trialLogsUsed < 15) {
          return true;
        }
        
        return false;
      },
      
      getRemainingTrialLogs: () => {
        const state = get();
        if (state.trialCompleted) return 0;
        return Math.max(0, 15 - state.trialLogsUsed);
      },
      
      resetTrial: () => {
        set({
          trialLogsUsed: 0,
          trialCompleted: false,
          trialProjectId: null
        });
      },
      
      assignTokenToProject: (projectId: string) => {
        const state = get();
        if (state.tokens > 0) {
          set({
            tokens: state.tokens - 1,
            projectLogCounts: {
              ...state.projectLogCounts,
              [projectId]: -1 // -1 means unlimited logs
            }
          });
          return true;
        }
        return false;
      },
      
      getProjectLogCount: (projectId: string) => {
        const state = get();
        return state.projectLogCounts[projectId] || 0;
      },
      
      setProjectLogCount: (projectId: string, count: number) => {
        const state = get();
        set({
          projectLogCounts: {
            ...state.projectLogCounts,
            [projectId]: count
          }
        });
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