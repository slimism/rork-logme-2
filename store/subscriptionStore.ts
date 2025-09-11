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
}

const TRIAL_LOG_LIMIT = 15;

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
        if (state.trialLogsUsed < TRIAL_LOG_LIMIT && !state.trialCompleted) {
          set({ trialLogsUsed: state.trialLogsUsed + 1 });
          return true;
        }
        return false;
      },
      
      canCreateProject: () => {
        const state = get();
        return state.tokens > 0 || (!state.trialCompleted && state.trialLogsUsed < TRIAL_LOG_LIMIT);
      },
      
      canAddLog: () => {
        const state = get();
        return state.tokens > 0 || (!state.trialCompleted && state.trialLogsUsed < TRIAL_LOG_LIMIT);
      },
      
      getRemainingTrialLogs: () => {
        const state = get();
        return Math.max(0, TRIAL_LOG_LIMIT - state.trialLogsUsed);
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