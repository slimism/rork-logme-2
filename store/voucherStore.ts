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
  {
    code: 'WELCOME1',
    type: 'token',
    value: 1,
    description: '1 Free Token',
    used: false,
  },
  {
    code: 'BOOST4',
    type: 'token',
    value: 4,
    description: '4 Free Tokens',
    used: false,
  },
  {
    code: 'MEGA10',
    type: 'token',
    value: 10,
    description: '10 Free Tokens',
    used: false,
  },
  {
    code: 'UNLIMITED',
    type: 'unlimited',
    value: 999999,
    description: 'Unlimited Tokens',
    used: false,
  },
  {
    code: 'SAVE20',
    type: 'discount',
    value: 20,
    description: '20% Discount (One-time use)',
    used: false,
  },
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
              message: 'Success! 20% discount applied to all token purchases',
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
        return !state.discountUsed;
      },
    }),
    {
      name: 'voucher-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
