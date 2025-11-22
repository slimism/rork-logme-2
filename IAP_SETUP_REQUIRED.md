# IAP Setup - Information Required

## ✅ What's Been Completed

1. **expo-store-kit installed** - Added to `package.json` (you'll need to run `npm install` or your package manager)
2. **Real StoreKit implementation** - Replaced mock IAP service with actual iOS StoreKit integration
3. **Store UI updated** - Store screen now uses real IAP products from App Store Connect
4. **Old product IDs removed** - Ready for your new product IDs

## 📋 Information You Need to Provide

To complete the IAP setup, please provide the following information for each product you want to offer:

### For Each Product:

1. **Product ID** (required)
   - Format: Reverse domain notation (e.g., `com.yourcompany.logme.tokens.single`)
   - Must match exactly what you create in App Store Connect
   - Cannot be changed once created in App Store Connect

2. **Token Count** (required)
   - How many tokens this product grants (e.g., 1, 4, 10)

3. **Product Details** (optional - these come from App Store Connect)
   - Title and description are automatically fetched from App Store Connect
   - Prices are automatically fetched from App Store Connect

### Example Format:

```
Product 1:
- Product ID: com.yourcompany.logme.tokens.single
- Tokens: 1

Product 2:
- Product ID: com.yourcompany.logme.tokens.pack4
- Tokens: 4

Product 3:
- Product ID: com.yourcompany.logme.tokens.pack10
- Tokens: 10
```

## 🔧 Where to Add Your Product IDs

Once you provide the product IDs and token counts, I'll update:

1. **`services/iapService.ts`** - Lines 25-40
   - Add your product IDs to the `PRODUCT_IDS` array
   - Add product ID to token count mapping in `PRODUCT_TO_TOKEN_MAP`

## 📱 App Store Connect Setup Steps

Before the IAP will work, you need to:

1. **Create In-App Purchase Products in App Store Connect:**
   - Go to your app in App Store Connect
   - Navigate to Features → In-App Purchases
   - Click "+" to create new products
   - Choose "Consumable" as the product type
   - Enter your Product ID (must match what you provide to me)
   - Set pricing tier
   - Add display name and description
   - Upload review screenshot
   - Save and submit for review

2. **Enable In-App Purchase Capability in Xcode:**
   - Open your project in Xcode
   - Go to Signing & Capabilities
   - Add "In-App Purchase" capability

3. **Test with Sandbox Account:**
   - Create sandbox tester account in App Store Connect
   - Test on physical iOS device (not simulator)
   - Sign in with sandbox account when prompted

## ⚠️ Important Notes

- **iOS Only**: Currently configured for iOS only (as requested)
- **Product IDs are permanent**: Once created in App Store Connect, product IDs cannot be changed
- **Testing**: IAP only works on physical devices, not in simulator
- **Sandbox**: Use sandbox test accounts for testing before going live

## 🚀 Next Steps

1. Provide me with your product IDs and token counts
2. I'll update the code with your product IDs
3. Install dependencies: Run `npm install` (or your package manager)
4. Create products in App Store Connect
5. Test with sandbox account on physical device
6. Submit for review

