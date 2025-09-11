import React from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { Film, FolderOpen, ShoppingCart } from "lucide-react-native";
import { colors } from "@/constants/colors";


export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          headerShown: true,
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopColor: colors.border,
            paddingBottom: 0,
          },
          headerStyle: {
            backgroundColor: 'white',
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Projects",
            tabBarLabel: "Projects",
            tabBarIcon: ({ color, size }) => (
              <FolderOpen size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="store"
          options={{
            title: "Store",
            tabBarLabel: "Store",
            tabBarIcon: ({ color, size }) => (
              <ShoppingCart size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="about"
          options={{
            title: "About",
            tabBarLabel: "About",
            tabBarIcon: ({ color, size }) => (
              <Film size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}