import { Platform } from 'react-native';

// Conditionally import react-native-iap - only available in development/production builds, not Expo Go
let RNIap: any = null;
try {
  RNIap = require('react-native-iap');
} catch (error) {
  // react-native-iap not available (likely running in Expo Go)
  console.log('react-native-iap not available - running in Expo Go or module not installed');
}

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

      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        console.log('IAP only supported on iOS and Android');
        return false;
      }

      // Check if react-native-iap is available (not available in Expo Go)
      if (!RNIap) {
        console.warn(`react-native-iap not available. IAP requires a development build. Use "npx expo run:${Platform.OS}" or EAS Build.`);
        return false;
      }

      // Check if product IDs are configured
      if (PRODUCT_IDS.length === 0) {
        console.warn('No product IDs configured. Please add your product IDs in services/iapService.ts');
        return false;
      }

      // Initialize react-native-iap connection
      await RNIap.initConnection();
      
      this.initialized = true;
      console.log(`IAP Service initialized successfully for ${Platform.OS}`);
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

    if (Platform.OS === 'web' || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
      return [];
    }

    try {
      if (!RNIap) {
        console.warn('react-native-iap not available. IAP requires a development build.');
        return [];
      }

      if (PRODUCT_IDS.length === 0) {
        console.warn('No product IDs configured');
        return [];
      }

      // Fetch products from App Store (iOS) or Google Play (Android)
      const products = await RNIap.getProducts({ skus: PRODUCT_IDS });
      
      // Map react-native-iap products to our IAPProduct format
      return products.map((product: any) => ({
        productId: product.productId,
        price: product.localizedPrice || product.price,
        currency: product.currency || 'USD',
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

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return {
        success: false,
        error: 'In-app purchases are only available on iOS and Android',
      };
    }

    if (!RNIap) {
      return {
        success: false,
        error: `IAP requires a development build. Use "npx expo run:${Platform.OS}" or EAS Build to test purchases.`,
      };
    }

    try {
      console.log(`Attempting to purchase product: ${productId}`);
      
      // Set up purchase listener before initiating purchase
      return new Promise<PurchaseResult>((resolve) => {
        const purchaseUpdateListener = RNIap.purchaseUpdatedListener((purchase: any) => {
          purchaseUpdateListener.remove();
          purchaseErrorListener.remove();
          
          if (purchase.productId === productId) {
            // Finish the transaction
            RNIap.finishTransaction({ purchase });
            
            resolve({
              success: true,
              productId: purchase.productId,
              transactionId: purchase.transactionId || purchase.transactionReceipt,
            });
          }
        });
        
        // Handle purchase errors
        const purchaseErrorListener = RNIap.purchaseErrorListener((error: any) => {
          purchaseErrorListener.remove();
          purchaseUpdateListener.remove();
          
          let errorMessage = 'Purchase failed';
          if (error.code === 'E_USER_CANCELLED') {
            errorMessage = 'Purchase was canceled';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          resolve({
            success: false,
            error: errorMessage,
          });
        });
        
        // Initiate purchase
        RNIap.requestPurchase({ sku: productId }).catch((error: any) => {
          purchaseErrorListener.remove();
          purchaseUpdateListener.remove();
          
          resolve({
            success: false,
            error: error.message || 'Purchase failed',
          });
        });
        
        // Timeout after 60 seconds
        setTimeout(() => {
          purchaseUpdateListener.remove();
          purchaseErrorListener.remove();
          resolve({
            success: false,
            error: 'Purchase timeout',
          });
        }, 60000);
      });
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

    if (Platform.OS === 'web' || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
      return [];
    }

    if (!RNIap) {
      console.warn('react-native-iap not available. IAP requires a development build.');
      return [];
    }

    try {
      console.log('Restoring purchases...');
      
      // Restore completed transactions
      const purchases = await RNIap.getAvailablePurchases();
      
      return purchases.map((purchase: any) => ({
        success: true,
        productId: purchase.productId,
        transactionId: purchase.transactionId || purchase.transactionReceipt,
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