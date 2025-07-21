// _layout.js (or RootLayout.js)
import { Stack } from "expo-router";
import "../global.css";
import React, { useEffect } from "react"; // No need for useCallback here, it was for onLayout
import { Text, View, StyleSheet } from "react-native"; // Add StyleSheet for temporary testing
import { useFonts } from "expo-font";
import {
  Marhey_300Light,
  Marhey_400Regular,
  Marhey_500Medium,
  Marhey_600SemiBold,
  Marhey_700Bold,
} from "@expo-google-fonts/marhey";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Marhey_300Light,
    Marhey_400Regular,
    Marhey_500Medium,
    Marhey_600SemiBold,
    Marhey_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    } else {
    }
  }, [fontsLoaded, fontError]); // Dependency array: run when these change

  if (!fontsLoaded && !fontError) {
    return null; // Keep splash screen visible while loading
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "العبة قيد التطوير", headerShown: false }}
      />
    </Stack>
  );
}
