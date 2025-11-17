import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTokenStore } from './subscriptionStore';

export interface Voucher {
  code: string;
  type: 'token' | 'unlimited' | 'discount';
  value: number;
  description: string;
  used: boolean;
}

interface VoucherState {
  vouchers: Voucher[];
  usedVouchers: string[];
  discountUsed: boolean;
  initializeDefaultVouchers: () => void;
  redeemVoucher: (code: string) => { success: boolean; message: string; voucher?: Voucher };
  isVoucherUsed: (code: string) => boolean;
  canUseDiscount: () => boolean;
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

  // 20% Off Any Bundle codes
  { code: 'OFF20NOW', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'SAVE20LMA', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'LM20OFF', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'OFF20LOGM', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'LOGME20OFF', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'OFF20BNDL', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'BUNDLE20OFF', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'GET20OFFLM', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'OFF20-LM', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },
  { code: 'LM20SAVE', type: 'discount', value: 20, description: '20% Off Any Bundle', used: false },

  // 25% Off Any Bundle
  { code: 'LMNEWYEAR26', type: 'discount', value: 25, description: '25% Off Any Bundle', used: false },

  // 30% Off Any Bundle codes
  { code: 'LESS30OFF', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'LM30SAVE', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: '30LMOFFNOW', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'OFF30LESS', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'LOGME30BUNDLE', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'BUNDLE30LMA', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'LESS30BNDL', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'GET30OFFLMLSS', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'OFF30-LOGM', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
  { code: 'LM30SAVEBUNDLE', type: 'discount', value: 30, description: '30% Off Any Bundle', used: false },
];

export const useVoucherStore = create<VoucherState>()(
  persist(
    (set, get) => ({
      vouchers: DEFAULT_VOUCHERS,
      usedVouchers: [],
      discountUsed: false,

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

        if (voucher.type === 'discount' && state.discountUsed) {
          return { success: false, message: 'Discount voucher can only be used once per device' };
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

          case 'discount':
            set((state) => ({
              usedVouchers: [...state.usedVouchers, normalizedCode],
              discountUsed: true,
            }));
            return {
              success: true,
              message: `Success! ${voucher.value}% discount applied to all token purchases`,
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

      canUseDiscount: () => {
        const state = get();
        return state.discountUsed;
      },
    }),
    {
      name: 'voucher-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
