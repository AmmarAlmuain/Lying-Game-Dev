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
  console.log("RootLayout: Component re-rendered."); // Log every render

  const [fontsLoaded, fontError] = useFonts({
    Marhey_300Light,
    Marhey_400Regular,
    Marhey_500Medium,
    Marhey_600SemiBold,
    Marhey_700Bold,
  });

  console.log("RootLayout: fontsLoaded =", fontsLoaded);
  console.log("RootLayout: fontError =", fontError);

  useEffect(() => {
    console.log("RootLayout: useEffect triggered.");
    if (fontsLoaded || fontError) {
      console.log("RootLayout: Attempting to hide splash screen.");
      SplashScreen.hideAsync();
    } else {
      console.log(
        "RootLayout: Fonts not loaded/error, not hiding splash screen yet."
      );
    }
  }, [fontsLoaded, fontError]); // Dependency array: run when these change

  if (!fontsLoaded && !fontError) {
    console.log("RootLayout: Returning null (splash screen visible).");
    return null; // Keep splash screen visible while loading
  }

  console.log("RootLayout: Fonts loaded, rendering Stack navigator.");
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "العبة قيد التطوير", headerShown: false }}
      />
    </Stack>
  );
}
