import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import CustomSplashScreen from "@/components/SplashScreen";
import Toast from 'react-native-toast-message';
import { useThemeStore } from '@/store/themeStore';
import { colors } from '@/constants/colors';

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

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { darkMode } = useThemeStore();
  const statusBarStyle: 'light' | 'dark' = darkMode ? 'light' : 'dark';

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: colors.card as string,
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
            color: colors.text as string,
          },
          contentStyle: {
            backgroundColor: colors.background as string,
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
        <Stack.Screen 
          name="folder/[id]" 
          options={{ 
            title: "Folder",
            headerBackTitle: "Project"
          }} 
        />
        <Stack.Screen 
          name="logsheet/[id]" 
          options={{ 
            title: "Log Sheet",
            headerBackTitle: "Folder"
          }} 
        />
      </Stack>
      <Toast />
    </>
  );
}