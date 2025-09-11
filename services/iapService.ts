import { Platform, Alert } from 'react-native';

export interface IAPProduct {
  productId: string;
  price: string;
  currency: string;
  title: string;
  description: string;
  tokens: number;
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

// Mock products for development - replace with actual product IDs from App Store Connect
const MOCK_PRODUCTS: IAPProduct[] = [
  {
    productId: 'com.logme.tokens.single',
    price: '$6.99',
    currency: 'USD',
    title: '1 Token',
    description: 'Single project token',
    tokens: 1,
  },
  {
    productId: 'com.logme.tokens.pack4',
    price: '$24.99',
    currency: 'USD',
    title: '4 Tokens Pack',
    description: 'Four project tokens with savings',
    tokens: 4,
  },
  {
    productId: 'com.logme.tokens.pack10',
    price: '$49.99',
    currency: 'USD',
    title: '10 Tokens Pack',
    description: 'Ten project tokens with maximum savings',
    tokens: 10,
  },
];

class IAPService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        console.log('IAP not available on web platform');
        return false;
      }

      // TODO: Initialize actual IAP service when building for production
      // Example with expo-store-kit:
      // await StoreKit.initialize();
      
      this.initialized = true;
      console.log('IAP Service initialized (mock mode)');
      return true;
    } catch (error) {
      console.error('Failed to initialize IAP service:', error);
      return false;
    }
  }

  async getProducts(): Promise<IAPProduct[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (Platform.OS === 'web') {
      return [];
    }

    try {
      // TODO: Replace with actual product fetching
      // Example with expo-store-kit:
      // const products = await StoreKit.getProductsAsync(['com.logme.tokens.single', ...]);
      
      // For now, return mock products
      return MOCK_PRODUCTS;
    } catch (error) {
      console.error('Failed to fetch products:', error);
      return [];
    }
  }

  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (Platform.OS === 'web') {
      return {
        success: false,
        error: 'In-app purchases are not available on web platform',
      };
    }

    try {
      // TODO: Replace with actual purchase logic
      // Example with expo-store-kit:
      // const result = await StoreKit.purchaseProductAsync(productId);
      
      // Mock purchase for development
      console.log(`Attempting to purchase product: ${productId}`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful purchase
      const transactionId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        productId,
        transactionId,
      };
    } catch (error) {
      console.error('Purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed',
      };
    }
  }

  async restorePurchases(): Promise<PurchaseResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (Platform.OS === 'web') {
      return [];
    }

    try {
      // TODO: Replace with actual restore logic
      // Example with expo-store-kit:
      // const transactions = await StoreKit.restoreCompletedTransactionsAsync();
      
      console.log('Restoring purchases (mock mode)');
      return [];
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      return [];
    }
  }

  getTokensForProduct(productId: string): number {
    const product = MOCK_PRODUCTS.find(p => p.productId === productId);
    return product?.tokens || 0;
  }
}

export const iapService = new IAPService();