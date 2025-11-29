import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTokenStore } from './subscriptionStore';

export interface Voucher {
  code: string;
  type: 'token' | 'unlimited';
  value: number;
  description: string;
  used: boolean;
}

interface VoucherState {
  vouchers: Voucher[];
  usedVouchers: string[];
  initializeDefaultVouchers: () => void;
  redeemVoucher: (code: string) => { success: boolean; message: string; voucher?: Voucher };
  isVoucherUsed: (code: string) => boolean;
}

const DEFAULT_VOUCHERS: Voucher[] = [
  // 1 Free Token codes
  { code: 'WELCOME01LOGS', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WLCM1FREE', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WELCMN1TKN', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WELC1TOKEN', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WLCM1TOKN', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WELCOME-1F', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WELCOMEONE', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WELCOME-01', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WLCM-1FREE', type: 'token', value: 1, description: '1 Free Token', used: false },
  { code: 'WELC1TKNS', type: 'token', value: 1, description: '1 Free Token', used: false },

  // 4 Free Tokens codes
  { code: 'LOGME4TKN', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'FREE4LOGM', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'LOG4TOKENS', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'LM4FREE', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'LOGM-4TKN', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'LOG4FREE', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'GET4LOGM', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: '4TOKENSLM', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'LM4TKNFREE', type: 'token', value: 4, description: '4 Free Tokens', used: false },
  { code: 'LOG4NOW', type: 'token', value: 4, description: '4 Free Tokens', used: false },

  // 10 Free Tokens codes
  { code: 'LOGME10TKNS', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'FREE10LOGM', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'LOG10TOKENS', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'LM10FREE', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'LOGM-10TKNS', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'LOG10FREE', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'GET10LOGM', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: '10TOKENSLM', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'LM10TKNFREE', type: 'token', value: 10, description: '10 Free Tokens', used: false },
  { code: 'LOG10NOW', type: 'token', value: 10, description: '10 Free Tokens', used: false },

  // Unlimited Tokens
  { code: 'LOGMUNLIMIT1', type: 'unlimited', value: 999999, description: 'Unlimited Tokens', used: false },
];

export const useVoucherStore = create<VoucherState>()(
  persist(
    (set, get) => ({
      vouchers: DEFAULT_VOUCHERS,
      usedVouchers: [],

      initializeDefaultVouchers: () => {
        const state = get();
        if (state.vouchers.length === 0) {
          set({ vouchers: DEFAULT_VOUCHERS });
        }
      },

      redeemVoucher: (code: string) => {
        const state = get();
        const normalizedCode = code.trim().toUpperCase();
        
        const voucher = state.vouchers.find(v => v.code === normalizedCode);
        
        if (!voucher) {
          return { success: false, message: 'Invalid voucher code' };
        }
        
        if (state.usedVouchers.includes(normalizedCode)) {
          return { success: false, message: 'This voucher has already been used' };
        }

        const tokenStore = useTokenStore.getState();

        switch (voucher.type) {
          case 'token':
            tokenStore.addTokens(voucher.value);
            set((state) => ({
              usedVouchers: [...state.usedVouchers, normalizedCode],
            }));
            return {
              success: true,
              message: `Success! ${voucher.value} token${voucher.value > 1 ? 's' : ''} added to your account`,
              voucher,
            };

          case 'unlimited':
            tokenStore.addTokens(voucher.value);
            set((state) => ({
              usedVouchers: [...state.usedVouchers, normalizedCode],
            }));
            return {
              success: true,
              message: 'Success! You now have unlimited tokens',
              voucher,
            };

          default:
            return { success: false, message: 'Invalid voucher type' };
        }
      },

      isVoucherUsed: (code: string) => {
        const state = get();
        return state.usedVouchers.includes(code.trim().toUpperCase());
      },
    }),
    {
      name: 'voucher-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
