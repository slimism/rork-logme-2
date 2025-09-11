import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: 'white',
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: '#f8f8f8',
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
    </>
  );
}