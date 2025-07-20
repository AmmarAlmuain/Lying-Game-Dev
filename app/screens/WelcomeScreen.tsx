import React, { useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  ImageBackground,
  Image,
  Pressable,
  Animated,
} from "react-native";
import { changePlayerUsername } from "../../services/player";

interface Card {
  rank: string;
  suit: string;
}
interface Player {
  id: string;
  username: string;
  is_host: boolean;
  hand_cards: Card[];
  card_count: number;
}

interface WelcomeScreenProps {
  localPlayer: Player | null;
  setLocalPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  usernameInput: string;
  setUsernameInput: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  onPlayPress: () => void;
  loading: boolean;
}

export default function WelcomeScreen({
  localPlayer,
  setLocalPlayer,
  usernameInput,
  setUsernameInput,
  setLoading,
  setError,
  onPlayPress,
  loading,
}: WelcomeScreenProps) {
  const handleChangeUsername = async () => {
    if (!usernameInput.trim()) {
      Alert.alert("خطأ", "لا يمكن أن يكون اسم المستخدم فارغاً.");
      return;
    }
    setLoading(true);
    try {
      await changePlayerUsername(usernameInput.trim());
      setLocalPlayer((prev) =>
        prev ? { ...prev, username: usernameInput.trim() } : null
      );
      Alert.alert("نجاح", "تم تحديث اسم المستخدم!");
    } catch (err: any) {
      console.error("Error changing username:", err);
      setError(err.message || "فشل في تغيير اسم المستخدم.");
    } finally {
      setLoading(false);
    }
  };

  const playButtonScale = useRef(new Animated.Value(1)).current;
  const verifyButtonScale = useRef(new Animated.Value(1)).current;
  const rulesButtonScale = useRef(new Animated.Value(1)).current;

  const animatePressIn = (scaleAnim: Animated.Value) => {
    if (!loading) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 5,
        tension: 100,
      }).start();
    }
  };

  const animatePressOut = (scaleAnim: Animated.Value) => {
    if (!loading) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 100,
      }).start();
    }
  };

  return (
    <View
      id="welcome-screen"
      className="relative items-center flex-1 w-full h-full"
    >
      <ImageBackground
        source={require("../../assets/images/background.jpg")}
        className="items-center justify-center flex-1 w-full h-full"
        resizeMode="cover"
      >
        <View id="header-cards" className="absolute top-0 left-0 w-full h-56">
          <Image
            source={require("@/assets/images/header-cards.png")}
            className="object-cover w-full h-full"
          />
        </View>

        <View id="logo" className="w-64 h-48">
          <Image
            source={require("@/assets/images/logo.png")}
            className="object-cover w-full h-full"
          />
        </View>

        <View className="flex items-center gap-y-8 mt-14">
          <Pressable
            id="play-button"
            className={`w-[324px] h-[65px] ${loading ? "opacity-50" : ""}`}
            onPress={onPlayPress}
            onPressIn={() => animatePressIn(playButtonScale)}
            onPressOut={() => animatePressOut(playButtonScale)}
            disabled={loading}
          >
            <Animated.Image
              source={require("@/assets/images/play-button.png")}
              className="object-cover w-full h-full"
              style={{ transform: [{ scale: playButtonScale }] }}
            />
          </Pressable>
          <View id="divider" className="w-[310px] h-px bg-white/30"></View>
          <View className="flex gap-y-6">
            <TextInput
              id="username-input"
              className="w-[324px] h-[70px] text-center border-4 text-2xl font-marhey-regular border-white rounded-[15px] text-[#F0CCFF] bg-[#C94CFF]/30"
              placeholder="أدخل اسم المستخدم"
              placeholderTextColor="#F0CCFF"
              value={usernameInput}
              onChangeText={setUsernameInput}
              editable={!loading}
            />
            <Pressable
              id="verify-button"
              className={`w-[324px] h-[65px] ${loading ? "opacity-50" : ""}`}
              onPress={handleChangeUsername}
              onPressIn={() => animatePressIn(verifyButtonScale)}
              onPressOut={() => animatePressOut(verifyButtonScale)}
              disabled={loading}
            >
              <Animated.Image
                source={require("@/assets/images/verify-button.png")}
                className="object-cover w-full h-full"
                style={{ transform: [{ scale: verifyButtonScale }] }}
              />
            </Pressable>
          </View>
        </View>
        <View
          id="footer"
          className="absolute w-[324px] flex flex-row justify-between items-center bottom-12"
        >
          <Pressable
            id="rules-button"
            className="w-48 h-[50px]"
            onPress={() =>
              Alert.alert("قوانين اللعبة", "هنا ستكون قوانين اللعبة.")
            }
            onPressIn={() => animatePressIn(rulesButtonScale)}
            onPressOut={() => animatePressOut(rulesButtonScale)}
            disabled={loading}
          >
            <Animated.Image
              source={require("@/assets/images/rules-button.png")}
              className="object-cover w-full h-full"
              style={{ transform: [{ scale: rulesButtonScale }] }}
            />
          </Pressable>
          <Text
            id="game-version"
            className="text-xl text-white font-marhey-bold"
          >
            نسخه 0.3
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}
