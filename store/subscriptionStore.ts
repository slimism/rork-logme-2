import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TokenState {
  tokens: number;
  trialLogsUsed: number;
  trialCompleted: boolean;
  addTokens: (count: number) => void;
  useToken: () => boolean;
  useTrial: () => boolean;
  canCreateProject: () => boolean;
  canAddLog: () => boolean;
  getRemainingTrialLogs: () => number;
  isOnTrial: () => boolean;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      tokens: 0,
      trialLogsUsed: 0,
      trialCompleted: false,
      
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
      
      useTrial: () => {
        const state = get();
        if (state.trialLogsUsed < 15 && !state.trialCompleted) {
          const newTrialLogsUsed = state.trialLogsUsed + 1;
          const isTrialCompleted = newTrialLogsUsed >= 15;
          set({ 
            trialLogsUsed: newTrialLogsUsed,
            trialCompleted: isTrialCompleted
          });
          return true;
        }
        return false;
      },
      
      canCreateProject: () => {
        const state = get();
        // Can create project if has tokens OR is on trial and hasn't used it yet
        return state.tokens > 0 || (state.trialLogsUsed === 0 && !state.trialCompleted);
      },
      
      canAddLog: () => {
        const state = get();
        // Can add log if has tokens OR still has trial logs remaining
        return state.tokens > 0 || (state.trialLogsUsed < 15 && !state.trialCompleted);
      },
      
      getRemainingTrialLogs: () => {
        const state = get();
        if (state.trialCompleted || state.trialLogsUsed >= 15) {
          return 0;
        }
        return 15 - state.trialLogsUsed;
      },
      
      isOnTrial: () => {
        const state = get();
        return state.tokens === 0 && state.trialLogsUsed < 15 && !state.trialCompleted;
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