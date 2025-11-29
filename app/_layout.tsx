import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import CustomSplashScreen from "@/components/SplashScreen";
import Toast from 'react-native-toast-message';
import { useThemeStore } from '@/store/themeStore';
import { useColors } from '@/constants/colors';
import { OrientationGuard } from '@/components/OrientationGuard';
import '@/utils/consoleLogger';

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState<boolean>(true);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <CustomSplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <OrientationGuard>
      <RootLayoutNav />
    </OrientationGuard>
  );
}

function RootLayoutNav() {
  const { darkMode } = useThemeStore();
  const colors = useColors();
  const statusBarStyle: 'light' | 'dark' = darkMode ? 'light' : 'dark';

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
            color: colors.text,
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="project/[id]" 
          options={{ 
            title: "Project",
            headerBackTitle: "Projects"
          }} 
        />
      </Stack>
      <Toast />
    </>
  );
}