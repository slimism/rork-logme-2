# In-App Purchase Implementation Guide

This document provides instructions for implementing actual In-App Purchases (IAP) when building the LogMe app for production.

## Current Implementation

The app currently includes:
- ✅ Token-based monetization system
- ✅ Store UI with product packages
- ✅ Mock IAP service for development
- ✅ Token management with Zustand
- ✅ Trial system (15 free logs)

## Production IAP Setup

### 1. App Store Connect Configuration

1. **Create In-App Purchase Products:**
   - Single Token: `com.logme.tokens.single` - $6.99
   - 4 Tokens Pack: `com.logme.tokens.pack4` - $24.99
   - 10 Tokens Pack: `com.logme.tokens.pack10` - $49.99

2. **Product Types:** Use "Consumable" for all token products

3. **Localization:** Add product titles and descriptions for target markets

### 2. Google Play Console Configuration

1. **Create In-App Products:**
   - Use same product IDs as iOS
   - Set appropriate pricing tiers
   - Mark as "Managed products" (consumable)

### 3. Code Implementation

#### Install Required Packages
```bash
# For production builds (not available in Expo Go)
npx expo install expo-store-kit
```

#### Update app.json
```json
{
  "expo": {
    "ios": {
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "android": {
      "permissions": [
        "com.android.vending.BILLING"
      ]
    }
  }
}
```

#### Replace Mock IAP Service

Update `services/iapService.ts`:

```typescript
import * as StoreKit from 'expo-store-kit';

class IAPService {
  async initialize(): Promise<boolean> {
    try {
      await StoreKit.initialize();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize IAP service:', error);
      return false;
    }
  }

  async getProducts(): Promise<IAPProduct[]> {
    const productIds = [
      'com.logme.tokens.single',
      'com.logme.tokens.pack4',
      'com.logme.tokens.pack10'
    ];
    
    const products = await StoreKit.getProductsAsync(productIds);
    return products.map(product => ({
      productId: product.productId,
      price: product.price,
      currency: product.currencyCode,
      title: product.title,
      description: product.description,
      tokens: this.getTokensForProductId(product.productId)
    }));
  }

  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      const result = await StoreKit.purchaseProductAsync(productId);
      
      if (result.responseCode === StoreKit.IAPResponseCode.OK) {
        // Verify purchase with your backend if needed
        return {
          success: true,
          productId,
          transactionId: result.transactionId
        };
      }
      
      return {
        success: false,
        error: 'Purchase failed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async restorePurchases(): Promise<PurchaseResult[]> {
    try {
      const transactions = await StoreKit.restoreCompletedTransactionsAsync();
      return transactions.map(transaction => ({
        success: true,
        productId: transaction.productId,
        transactionId: transaction.transactionId
      }));
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      return [];
    }
  }
}
```

### 4. Testing

#### iOS Testing
1. Create sandbox test accounts in App Store Connect
2. Use TestFlight for beta testing
3. Test all purchase flows and edge cases

#### Android Testing
1. Create test accounts in Google Play Console
2. Upload to Internal Testing track
3. Test purchase and restore functionality

### 5. Security Considerations

1. **Receipt Validation:** Implement server-side receipt validation
2. **Purchase Verification:** Verify purchases with Apple/Google servers
3. **Token Security:** Store tokens securely and validate on server
4. **Fraud Prevention:** Implement purchase verification and monitoring

### 6. Analytics and Monitoring

1. **Purchase Events:** Track successful/failed purchases
2. **Revenue Metrics:** Monitor token sales and conversion rates
3. **Error Monitoring:** Log IAP errors and failures
4. **User Behavior:** Track token usage patterns

## Current Mock Behavior

The current implementation simulates:
- ✅ Product loading with 2-second delay
- ✅ Purchase processing with success/failure states
- ✅ Token addition to user account
- ✅ Purchase restoration (empty for new users)
- ✅ Platform-specific availability (disabled on web)

## Migration Notes

When switching to production IAP:
1. Replace `services/iapService.ts` with actual implementation
2. Update product IDs to match App Store Connect/Google Play
3. Add receipt validation logic
4. Implement proper error handling
5. Add analytics tracking
6. Test thoroughly on both platforms

## Support

For IAP implementation support:
- iOS: Apple Developer Documentation
- Android: Google Play Billing Documentation
- Expo: expo-store-kit documentation