import React from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { FileText, ShoppingBag, Clock } from "lucide-react-native";
import { useColors } from "@/constants/colors";

export default function TabLayout() {
  const colors = useColors();
  
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.subtext,
          headerShown: true,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: 0,
          },
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
            color: colors.text,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            headerShown: false,
            tabBarLabel: "Projects",
            tabBarIcon: ({ color, size }) => (
              <FileText size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="store"
          options={{
            headerShown: false,
            tabBarLabel: "Store",
            tabBarIcon: ({ color, size }) => (
              <ShoppingBag size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="about"
          options={{
            headerShown: false,
            tabBarLabel: "About",
            tabBarIcon: ({ color, size }) => (
              <Clock size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="(projects)"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}