import React, { useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  ImageBackground,
  Pressable,
  Animated,
  Alert,
  Linking,
} from "react-native";

export default function LobbySelectionScreen({
  roomCodeInput,
  setRoomCodeInput,
  handleCreateRoom,
  handleJoinRoom,
  loading,
  handleBackPress,
}: {
  roomCodeInput: string;
  setRoomCodeInput: (text: string) => void;
  handleCreateRoom: () => void;
  handleJoinRoom: (code: string) => void;
  loading: boolean;
  handleBackPress: () => void;
}) {
  const createButtonScale = useRef(new Animated.Value(1)).current;
  const joinButtonScale = useRef(new Animated.Value(1)).current;
  const rulesButtonScale = useRef(new Animated.Value(1)).current;
  const backButtonScale = useRef(new Animated.Value(1)).current;

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

  const onJoinPress = () => {
    if (!roomCodeInput.trim()) {
      Alert.alert("خطأ", "الرجاء إدخال رمز الغرفة.");
      return;
    }
    handleJoinRoom(roomCodeInput);
  };

  return (
    <View
      id="lobby-selection-screen"
      className="relative items-center flex-1 w-full h-full"
    >
      <ImageBackground
        source={require("../../assets/images/background.jpg")}
        className="items-center justify-center flex-1 w-full h-full"
        resizeMode="cover"
      >
        <Pressable
          id="back-button"
          className="absolute top-12 left-6 w-[60px] h-[64px]"
          onPress={handleBackPress}
          onPressIn={() => animatePressIn(backButtonScale)}
          onPressOut={() => animatePressOut(backButtonScale)}
          disabled={loading}
        >
          <Animated.Image
            source={require("@/assets/images/back-button.png")}
            className="object-contain w-full h-full"
            style={{ transform: [{ scale: backButtonScale }] }}
          />
        </Pressable>

        <View id="logo" className="w-64 h-48">
          <Image
            source={require("@/assets/images/logo.png")}
            className="object-cover w-full h-full"
          />
        </View>

        <View className="flex items-center gap-y-8 mt-14">
          <View className="flex gap-y-6">
            <TextInput
              className="w-[324px] h-[70px] text-center border-4 text-2xl font-marhey-regular border-white rounded-[15px] text-[#F0CCFF] bg-[#C94CFF]/30"
              placeholder="أدخل رمز الغرفة"
              placeholderTextColor="#F0CCFF"
              value={roomCodeInput}
              onChangeText={setRoomCodeInput}
              editable={!loading}
              id="room-code-input"
            />

            <Pressable
              id="join-room-button"
              className={`w-[324px] h-[65px] ${
                loading || !roomCodeInput.trim() ? "opacity-50" : ""
              }`}
              onPress={onJoinPress}
              onPressIn={() => animatePressIn(joinButtonScale)}
              onPressOut={() => animatePressOut(joinButtonScale)}
              disabled={loading || !roomCodeInput.trim()}
            >
              <Animated.Image
                source={require("@/assets/images/join-room-button.png")}
                className="object-cover w-full h-full"
                style={{ transform: [{ scale: joinButtonScale }] }}
              />
            </Pressable>
          </View>
          <View id="divider" className="w-[310px] h-px bg-white/30"></View>
          <Pressable
            id="create-room-button"
            className={`w-[324px] h-[65px] ${loading ? "opacity-50" : ""}`}
            onPress={handleCreateRoom}
            onPressIn={() => animatePressIn(createButtonScale)}
            onPressOut={() => animatePressOut(createButtonScale)}
            disabled={loading}
          >
            <Animated.Image
              source={require("@/assets/images/create-room-button.png")}
              className="object-cover w-full h-full"
              style={{ transform: [{ scale: createButtonScale }] }}
            />
          </Pressable>
        </View>

        <View
          id="footer"
          className="absolute w-[324px] flex flex-row justify-between items-center bottom-12"
        >
          <Pressable
            id="rules-button"
            className="w-[60px] h-[64px]"
            onPress={async () => {
              await Linking.openURL("../../assets/rules.pdf");
            }}
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
            نسخة 0.4
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}
