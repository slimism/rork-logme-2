import { Platform } from 'react-native';
import * as StoreKit from 'expo-store-kit';

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

// ============================================================================
// IAP CONFIGURATION - App Store Connect product IDs
// ============================================================================
const PRODUCT_IDS: string[] = [
  'app.rork.logme.tokens.1',
  'app.rork.logme.tokens.4',
  'app.rork.logme.tokens.10',
];

// Map product IDs to token counts
// This mapping is used to determine how many tokens each product grants
const PRODUCT_TO_TOKEN_MAP: Record<string, number> = {
  'app.rork.logme.tokens.1': 1,
  'app.rork.logme.tokens.4': 4,
  'app.rork.logme.tokens.10': 10,
};
// ============================================================================

class IAPService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        console.log('IAP not available on web platform');
        return false;
      }

      if (Platform.OS !== 'ios') {
        console.log('IAP currently only supported on iOS');
        return false;
      }

      // Check if product IDs are configured
      if (PRODUCT_IDS.length === 0) {
        console.warn('No product IDs configured. Please add your product IDs in services/iapService.ts');
        return false;
      }

      // Initialize StoreKit
      await StoreKit.initialize();
      
      this.initialized = true;
      console.log('IAP Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize IAP service:', error);
      return false;
    }
  }

  async getProducts(): Promise<IAPProduct[]> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return [];
      }
    }

    if (Platform.OS === 'web' || Platform.OS !== 'ios') {
      return [];
    }

    try {
      if (PRODUCT_IDS.length === 0) {
        console.warn('No product IDs configured');
        return [];
      }

      // Fetch products from App Store
      const products = await StoreKit.getProductsAsync(PRODUCT_IDS);
      
      // Map StoreKit products to our IAPProduct format
      return products.map((product) => ({
        productId: product.productId,
        price: product.price,
        currency: product.currencyCode || 'USD',
        title: product.title || product.productId,
        description: product.description || '',
        tokens: this.getTokensForProduct(product.productId),
      }));
    } catch (error) {
      console.error('Failed to fetch products:', error);
      return [];
    }
  }

  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    if (!this.initialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'IAP service not initialized',
        };
      }
    }

    if (Platform.OS === 'web') {
      return {
        success: false,
        error: 'In-app purchases are not available on web platform',
      };
    }

    if (Platform.OS !== 'ios') {
      return {
        success: false,
        error: 'In-app purchases are currently only available on iOS',
      };
    }

    try {
      console.log(`Attempting to purchase product: ${productId}`);
      
      // Initiate purchase with StoreKit
      const result = await StoreKit.purchaseProductAsync(productId);
      
      if (result.responseCode === StoreKit.IAPResponseCode.OK) {
        return {
          success: true,
          productId: result.productId || productId,
          transactionId: result.transactionId,
        };
      } else {
        // Handle different response codes
        let errorMessage = 'Purchase failed';
        switch (result.responseCode) {
          case StoreKit.IAPResponseCode.USER_CANCELED:
            errorMessage = 'Purchase was canceled';
            break;
          case StoreKit.IAPResponseCode.PAYMENT_INVALID:
            errorMessage = 'Payment method is invalid';
            break;
          case StoreKit.IAPResponseCode.STORE_PRODUCT_NOT_AVAILABLE:
            errorMessage = 'Product is not available';
            break;
          default:
            errorMessage = `Purchase failed with code: ${result.responseCode}`;
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }
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
      const initialized = await this.initialize();
      if (!initialized) {
        return [];
      }
    }

    if (Platform.OS === 'web' || Platform.OS !== 'ios') {
      return [];
    }

    try {
      console.log('Restoring purchases...');
      
      // Restore completed transactions
      const transactions = await StoreKit.restoreCompletedTransactionsAsync();
      
      return transactions.map((transaction) => ({
        success: true,
        productId: transaction.productId,
        transactionId: transaction.transactionId,
      }));
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      return [];
    }
  }

  getTokensForProduct(productId: string): number {
    // Get token count from the mapping
    return PRODUCT_TO_TOKEN_MAP[productId] || 0;
  }
}

export const iapService = new IAPService();