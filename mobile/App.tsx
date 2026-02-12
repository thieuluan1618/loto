import "./global.css";
import { StatusBar } from "react-native";
import { useFonts, RobotoCondensed_700Bold } from "@expo-google-fonts/roboto-condensed";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import HomeScreen from "./src/screens/HomeScreen";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    RobotoCondensed_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <HomeScreen />
    </>
  );
}
