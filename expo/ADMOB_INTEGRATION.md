# AdMob Integration Guide

This app integrates Google AdMob for displaying ads to free users. The integration includes both banner ads and interstitial (popup) ads.

## Features

### Banner Ads
- Displayed at the bottom of screens for free users
- Hidden for Pro subscribers
- Uses test ad unit IDs (replace with your actual IDs)
- Graceful fallback to placeholder when ads fail to load

### Interstitial Ads
- Popup ads shown when free users:
  - Create a new project
  - Export a project to PDF
- Automatically skipped for Pro subscribers
- 5-second timeout fallback if ad fails to load

## Implementation

### Components
- `AdBanner.tsx` - Banner ad component
- `InterstitialAd.tsx` - Interstitial ad component with hook

### Usage

#### Banner Ads
```tsx
import AdBanner from '@/components/AdBanner';

// Add to bottom of screen
<AdBanner />
```

#### Interstitial Ads
```tsx
import { useInterstitialAd } from '@/components/InterstitialAd';

const { showInterstitialAd } = useInterstitialAd();

// Show ad before action
showInterstitialAd(() => {
  // Action to perform after ad
  performAction();
});
```

## Configuration

### Ad Unit IDs
Replace test IDs with your actual AdMob ad unit IDs:

**Banner Ad:**
- Test ID: `ca-app-pub-3940256099942544/6300978111`
- Replace in: `components/AdBanner.tsx`

**Interstitial Ad:**
- Test ID: `ca-app-pub-3940256099942544/1033173712`
- Replace in: `components/InterstitialAd.tsx`

### Platform Support
- **Mobile (iOS/Android)**: Full AdMob integration
- **Web**: Ads are disabled (returns null)

## Dependencies
- `react-native-google-mobile-ads`: Modern AdMob integration for React Native
- Uses dynamic imports to handle missing dependencies gracefully

## Pro Subscription
- Pro users never see ads
- Subscription status checked via `useSubscriptionStore`
- All ad components respect Pro status automatically

## Error Handling
- Graceful fallback when AdMob is unavailable
- Placeholder shown when banner ads fail to load
- Timeout fallback for interstitial ads
- Console logging for debugging

## Testing
- Uses Google's test ad unit IDs
- Safe for development and testing
- Replace with production IDs before release