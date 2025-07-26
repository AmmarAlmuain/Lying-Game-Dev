import { Stack } from "expo-router";
import "../global.css";
import React, { useEffect } from "react";
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
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
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
