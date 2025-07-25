import React, { useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ImageBackground,
  Alert,
  Modal,
  ScrollView,
  Pressable,
  Animated,
} from "react-native";

export default function GameScreen({
  roomInfo,
  localPlayer,
  selectedCards,
  setDeclaredRankInput,
  declaredRankInput,
  showFullLogModal,
  setShowFullLogModal,
  handleCardPress,
  handlePlayCards,
  handleSkipTurn,
  handleCallLie,
  handleDiscardQuads,
  handleLeaveRoom,
  handleStartGame,
  loading,
}: {
  roomInfo: Room | null;
  localPlayer: Player | null;
  selectedCards: Card[];
  declaredRankInput: string;
  setDeclaredRankInput: React.Dispatch<React.SetStateAction<string>>;
  showFullLogModal: boolean;
  setShowFullLogModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleCardPress: (card: Card) => void;
  handlePlayCards: () => void;
  handleSkipTurn: () => void;
  handleCallLie: () => void;
  handleDiscardQuads: (rank: string) => void;
  handleLeaveRoom: () => void;
  handleStartGame: () => void;
  loading: boolean;
}) {
  if (!roomInfo || !localPlayer) {
    console.warn(
      "GameScreen: roomInfo or localPlayer is null/undefined. Returning fallback UI."
    );
    return (
      <View className="items-center justify-center flex-1 bg-gray-100">
        <Text className="px-4 text-lg text-center text-red-500">
          خطأ في تحميل بيانات الغرفة أو اللاعب. يرجى المحاولة مرة أخرى.
        </Text>
        <TouchableOpacity
          className="px-6 py-3 mt-4 bg-blue-500 rounded-lg"
          onPress={handleLeaveRoom}
        >
          <Text className="text-base text-white">العودة للصفحة الرئيسية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const playersInRoom = roomInfo.players || [];
  const playerOnDevice = playersInRoom.find(
    (player) => player.id === localPlayer.id
  );

  const isMyTurn =
    roomInfo.turn_order_player_ids[roomInfo.current_player_index] ===
    localPlayer.id;
  const isHost = roomInfo?.host_player_id === localPlayer?.id;
  const gameStarted = roomInfo.status === "IN_PROGRESS";

  const canDiscardQuads =
    selectedCards.length === 4 &&
    selectedCards.every((card) => card.rank === selectedCards[0]?.rank);

  const animatePressIn = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const animatePressOut = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const playButtonScale = useRef(new Animated.Value(1)).current;
  const lieButtonScale = useRef(new Animated.Value(1)).current;
  const discardButtonScale = useRef(new Animated.Value(1)).current;
  const skipButtonScale = useRef(new Animated.Value(1)).current;
  const refreshButtonScale = useRef(new Animated.Value(1)).current;
  const leaveButtonScale = useRef(new Animated.Value(1)).current;
  const startGameButtonScale = useRef(new Animated.Value(1)).current;

  const cardImageMap: { [key: string]: any } = {
    "ace-h": require("../../assets/images/cards/ace-h.png"),
    "ace-d": require("../../assets/images/cards/ace-d.png"),
    "ace-c": require("../../assets/images/cards/ace-c.png"),
    "ace-s": require("../../assets/images/cards/ace-s.png"),
    "2-h": require("../../assets/images/cards/2-h.png"),
    "2-d": require("../../assets/images/cards/2-d.png"),
    "2-c": require("../../assets/images/cards/2-c.png"),
    "2-s": require("../../assets/images/cards/2-s.png"),
    "3-h": require("../../assets/images/cards/3-h.png"),
    "3-d": require("../../assets/images/cards/3-d.png"),
    "3-c": require("../../assets/images/cards/3-c.png"),
    "3-s": require("../../assets/images/cards/3-s.png"),
    "4-h": require("../../assets/images/cards/4-h.png"),
    "4-d": require("../../assets/images/cards/4-d.png"),
    "4-c": require("../../assets/images/cards/4-c.png"),
    "4-s": require("../../assets/images/cards/4-s.png"),
    "5-h": require("../../assets/images/cards/5-h.png"),
    "5-d": require("../../assets/images/cards/5-d.png"),
    "5-c": require("../../assets/images/cards/5-c.png"),
    "5-s": require("../../assets/images/cards/5-s.png"),
    "6-h": require("../../assets/images/cards/6-h.png"),
    "6-d": require("../../assets/images/cards/6-d.png"),
    "6-c": require("../../assets/images/cards/6-c.png"),
    "6-s": require("../../assets/images/cards/6-s.png"),
    "7-h": require("../../assets/images/cards/7-h.png"),
    "7-d": require("../../assets/images/cards/7-d.png"),
    "7-c": require("../../assets/images/cards/7-c.png"),
    "7-s": require("../../assets/images/cards/7-s.png"),
    "8-h": require("../../assets/images/cards/8-h.png"),
    "8-d": require("../../assets/images/cards/8-d.png"),
    "8-c": require("../../assets/images/cards/8-c.png"),
    "8-s": require("../../assets/images/cards/8-s.png"),
    "9-h": require("../../assets/images/cards/9-h.png"),
    "9-d": require("../../assets/images/cards/9-d.png"),
    "9-c": require("../../assets/images/cards/9-c.png"),
    "9-s": require("../../assets/images/cards/9-s.png"),
    "10-h": require("../../assets/images/cards/10-h.png"),
    "10-d": require("../../assets/images/cards/10-d.png"),
    "10-c": require("../../assets/images/cards/10-c.png"),
    "10-s": require("../../assets/images/cards/10-s.png"),
    "jack-h": require("../../assets/images/cards/jack-h.png"),
    "jack-d": require("../../assets/images/cards/jack-d.png"),
    "jack-c": require("../../assets/images/cards/jack-c.png"),
    "jack-s": require("../../assets/images/cards/jack-s.png"),
    "queen-h": require("../../assets/images/cards/queen-h.png"),
    "queen-d": require("../../assets/images/cards/queen-d.png"),
    "queen-c": require("../../assets/images/cards/queen-c.png"),
    "queen-s": require("../../assets/images/cards/queen-s.png"),
    "king-h": require("../../assets/images/cards/king-h.png"),
    "king-d": require("../../assets/images/cards/king-d.png"),
    "king-c": require("../../assets/images/cards/king-c.png"),
    "king-s": require("../../assets/images/cards/king-s.png"),
  };

  const getCardImageSource = (card: Card) => {
    const rank = card.rank.toLowerCase();
    const suitInitial = card.suit.charAt(0).toLowerCase();
    const key = `${rank}-${suitInitial}`;
    return cardImageMap[key] || require("../../assets/images/card-back.png");
  };

  const otherPlayers = playersInRoom.filter(
    (player) => player.id !== localPlayer.id
  );

  return (
    <View
      id="game-screen"
      className="relative items-center flex-1 w-full h-full"
    >
      <ImageBackground
        source={require("../../assets/images/background.jpg")}
        className="flex-1"
        resizeMode="cover"
      >
        <View className="flex-1 pt-12 gap-y-5">
          <View
            id="room-action"
            className="flex-row items-center justify-between"
          >
            <Pressable
              id="leave-room-button"
              className="w-[160px] h-12"
              onPress={handleLeaveRoom}
              onPressIn={() => animatePressIn(leaveButtonScale)}
              onPressOut={() => animatePressOut(leaveButtonScale)}
              disabled={loading}
            >
              <Animated.Image
                source={require("@/assets/images/leave-room-button.png")}
                className="object-contain w-full h-full"
                style={{ transform: [{ scale: leaveButtonScale }] }}
              />
            </Pressable>
          </View>

          <View
            id="game-log"
            className="flex flex-row items-center justify-end h-20 pr-5 gap-x-5 bg-black/30"
          >
            {roomInfo.game_log && roomInfo.game_log.length > 0 ? (
              <View className="flex flex-col-reverse items-end justify-end">
                <Text className="text-right text-white w-[280px] font-marhey-bold">
                  {roomInfo.game_log[roomInfo.game_log.length - 1].length > 40
                    ? `${roomInfo.game_log[roomInfo.game_log.length - 1].slice(
                        0,
                        120
                      )}...`
                    : roomInfo.game_log[roomInfo.game_log.length - 1]}
                </Text>
              </View>
            ) : (
              <Text className="text-white font-marhey-bold">
                لا يوجد سجل لعب بعد.
              </Text>
            )}
            <TouchableOpacity onPress={() => setShowFullLogModal(true)}>
              <Image
                source={require("@/assets/images/view-log-icon.png")}
                className="h-10 w-11"
              />
            </TouchableOpacity>
          </View>

          <View
            id="game-board"
            className="items-center relative w-full h-[460px] justify-around flex-1"
          >
            {/* Player 1 (Local Player - Bottom) */}
            {playerOnDevice && (
              <View
                key={playerOnDevice.id}
                id="player-one"
                className={`absolute flex justify-center items-center h-7 px-4 bottom-0 rounded-[20px] border-2 border-white self-center ${
                  playerOnDevice.id ===
                  roomInfo.turn_order_player_ids[roomInfo.current_player_index]
                    ? "bg-yellow-400"
                    : "bg-[#89299C]"
                }`}
              >
                <Text className="leading-none text-white font-marhey-regular">
                  {playerOnDevice.name} ({playerOnDevice.card_count})
                </Text>
              </View>
            )}
            {/* Player 2 (Top) */}
            {otherPlayers.length > 0 && (
              <View
                key={otherPlayers[0].id}
                id="player-two"
                className={`absolute flex justify-center items-center h-7 px-4 top-0 rounded-[20px] border-2 border-white self-center ${
                  otherPlayers[0].id ===
                  roomInfo.turn_order_player_ids[roomInfo.current_player_index]
                    ? "bg-yellow-400"
                    : "bg-[#89299C]"
                }`}
              >
                <Text className="leading-none text-white font-marhey-regular">
                  {otherPlayers[0].name} ({otherPlayers[0].card_count})
                </Text>
              </View>
            )}
            {/* Player 3 (Left) */}
            {otherPlayers.length > 1 && (
              <View
                key={otherPlayers[1].id}
                id="player-three"
                className={`absolute flex justify-center items-center h-7 px-4 left-0 rounded-[20px] border-2 border-white self-center ${
                  otherPlayers[1].id ===
                  playersInRoom[roomInfo.current_player_index]?.id
                    ? "bg-yellow-400"
                    : "bg-[#89299C]"
                }`}
                style={{ transform: [{ rotate: "90deg" }] }}
              >
                <Text className="leading-none text-white font-marhey-regular">
                  {otherPlayers[1].name} ({otherPlayers[1].card_count})
                </Text>
              </View>
            )}
            {/* Player 4 (Right) */}
            {otherPlayers.length > 2 && (
              <View
                key={otherPlayers[2].id}
                id="player-four"
                className={`absolute flex justify-center items-center h-7 px-4 right-0 rounded-[20px] border-2 border-white self-center ${
                  otherPlayers[2].id ===
                  playersInRoom[roomInfo.current_player_index]?.id
                    ? "bg-yellow-400"
                    : "bg-[#89299C]"
                }`}
                style={{ transform: [{ rotate: "-90deg" }] }}
              >
                <Text className="leading-none text-white font-marhey-regular">
                  {otherPlayers[2].name} ({otherPlayers[2].card_count})
                </Text>
              </View>
            )}
            <View
              id="player-hand-cards-container"
              className="absolute w-[324px] bottom-9 flex justify-center items-center"
            >
              <ScrollView horizontal className="flex-row">
                {(playerOnDevice?.hand_cards || []).map((card, index) => (
                  <TouchableOpacity
                    key={`${card.rank}-${card.suit}-${index}`}
                    className={`${
                      selectedCards.some(
                        (selectedCard) =>
                          selectedCard.rank === card.rank &&
                          selectedCard.suit === card.suit
                      )
                        ? "border-blue-500 border-2 rounded-lg"
                        : "border-gray-300"
                    }`}
                    onPress={() => handleCardPress(card)}
                    disabled={!isMyTurn || loading}
                  >
                    <Image
                      source={getCardImageSource(card)}
                      className="object-contain w-16 h-24"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {!gameStarted && isHost ? (
              <Pressable
                id="start-game-button"
                className={`w-[60px] h-[64px] absolute ${
                  loading ? "opacity-50" : ""
                }`}
                onPress={handleStartGame}
                onPressIn={() => animatePressIn(startGameButtonScale)}
                onPressOut={() => animatePressOut(startGameButtonScale)}
                disabled={loading}
              >
                <Animated.Image
                  source={require("@/assets/images/start-game-button.png")}
                  className="object-contain w-full h-full"
                  style={{ transform: [{ scale: startGameButtonScale }] }}
                />
              </Pressable>
            ) : gameStarted && roomInfo.pile_cards_count > 0 ? (
              <View
                id="card-pile-display"
                className="absolute items-center justify-center"
              >
                {roomInfo.last_played_cards_actual &&
                roomInfo.last_played_cards_actual.length > 0 ? (
                  <View className="flex-row">
                    <Image
                      source={require("@/assets/images/card-pile.png")}
                      className="object-contain w-[43px] h-[65px] mx-0.5"
                      style={{ transform: [{ rotate: "90deg" }] }}
                    />
                  </View>
                ) : null}
                <View className="absolute flex items-center justify-center w-6 h-6 border-2 border-white rounded-full bg-purple-pri">
                  <Text className="leading-none text-white font-marhey-re">
                    {roomInfo.pile_cards_count}
                  </Text>
                </View>
              </View>
            ) : gameStarted && roomInfo.pile_cards_count === 0 ? (
              <View
                id="empty-pile-display"
                className="absolute items-center justify-center"
              >
                <Text className="text-lg font-bold text-white">
                  الكومة فارغة
                </Text>
              </View>
            ) : null}
          </View>
          <View
            id="game-actions-and-details"
            className={`flex items-center justify-center w-full mb-12 ${
              isMyTurn && gameStarted ? "opacity-100" : "opacity-20"
            }`}
          >
            <View className="flex mb-2.5 flex-row items-center justify-between w-[324px]">
              <Text className="leading-none text-center text-white font-marhey-regular">
                الرتبة : {roomInfo.declared_rank || "لم يعلن"}
              </Text>
              <Text className="leading-none text-center text-white font-marhey-regular">
                رمز الغرفة: {roomInfo.room_code}
              </Text>
            </View>
            <View className="flex items-center justify-center w-full mb-5">
              {roomInfo.declared_rank === null && isMyTurn ? (
                <TextInput
                  id="rank-input"
                  className="w-[324px] h-[70px] text-center border-4 text-2xl font-marhey-regular border-white rounded-[15px] text-[#F0CCFF] bg-[#C94CFF]/30"
                  placeholder="الرتبة المعلنة (مثال: K أو 7)"
                  placeholderTextColor="#F0CCFF"
                  value={declaredRankInput}
                  onChangeText={setDeclaredRankInput}
                  editable={!loading || !isMyTurn || !gameStarted}
                />
              ) : null}
            </View>

            <View className="flex-row flex-wrap items-end justify-center">
              <Pressable
                id="call-lie-button"
                className={`w-[170px] h-[60px] ${
                  !gameStarted || loading || roomInfo.declared_rank === null
                    ? "opacity-50"
                    : ""
                }`}
                onPress={handleCallLie}
                onPressIn={() => animatePressIn(lieButtonScale)}
                onPressOut={() => animatePressOut(lieButtonScale)}
                disabled={
                  // Corrected disabled condition: should be !loading instead of !loading || !isMyTurn
                  loading ||
                  !isMyTurn ||
                  !gameStarted ||
                  roomInfo.declared_rank === null
                }
                style={{ transform: [{ scale: 0.85 }] }}
              >
                <Animated.Image
                  source={require("@/assets/images/call-lie-button.png")}
                  className="object-contain w-full h-full"
                  style={{ transform: [{ scale: lieButtonScale }] }}
                />
              </Pressable>
              <Pressable
                id="play-cards-button"
                className={`w-[170px] h-[60px] ${
                  !gameStarted ||
                  loading ||
                  selectedCards.length === 0 ||
                  (declaredRankInput.trim() === "" &&
                    roomInfo.declared_rank === null)
                    ? "opacity-50"
                    : ""
                }`}
                onPress={handlePlayCards}
                onPressIn={() => animatePressIn(playButtonScale)}
                onPressOut={() => animatePressOut(playButtonScale)}
                disabled={
                  !gameStarted ||
                  !isMyTurn ||
                  loading ||
                  selectedCards.length === 0 ||
                  (declaredRankInput.trim() === "" &&
                    roomInfo.declared_rank === null)
                }
                style={{ transform: [{ scale: 0.85 }] }}
              >
                <Animated.Image
                  source={require("@/assets/images/play-cards-button.png")}
                  className="object-contain w-full h-full"
                  style={{ transform: [{ scale: playButtonScale }] }}
                />
              </Pressable>
              <Pressable
                id="discard-quads-button"
                className={`w-[170px] h-[60px] ${
                  // Updated opacity condition
                  !gameStarted || loading || !isMyTurn || !canDiscardQuads
                    ? "opacity-50"
                    : ""
                }`}
                onPress={() => {
                  handleDiscardQuads(selectedCards[0]?.rank);
                }}
                onPressIn={() => animatePressIn(discardButtonScale)}
                onPressOut={() => animatePressOut(discardButtonScale)}
                disabled={
                  // Updated disabled condition
                  !gameStarted || loading || !isMyTurn || !canDiscardQuads
                }
                style={{ transform: [{ scale: 0.85 }] }}
              >
                <Animated.Image
                  source={require("@/assets/images/discard-quads-button.png")}
                  className="object-contain w-full h-full"
                  style={{ transform: [{ scale: discardButtonScale }] }}
                />
              </Pressable>
              <Pressable
                id="skip-turn-button"
                className={`w-[170px] h-[60px] ${
                  !gameStarted || loading || roomInfo.declared_rank === null
                    ? "opacity-50"
                    : ""
                }`}
                onPress={handleSkipTurn}
                onPressIn={() => animatePressIn(skipButtonScale)}
                onPressOut={() => animatePressOut(skipButtonScale)}
                disabled={
                  !gameStarted ||
                  loading ||
                  !isMyTurn ||
                  roomInfo.declared_rank === null
                }
                style={{ transform: [{ scale: 0.85 }] }}
              >
                <Animated.Image
                  source={require("@/assets/images/skip-turn-button.png")}
                  className="object-contain w-full h-full"
                  style={{ transform: [{ scale: skipButtonScale }] }}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showFullLogModal}
          onRequestClose={() => setShowFullLogModal(false)}
        >
          <View className="items-center justify-center flex-1 bg-black/50">
            <View className="w-11/12 p-6 bg-white rounded-lg max-h-3/4">
              <Text className="mb-4 text-xl font-bold text-gray-800">
                سجل اللعب الكامل
              </Text>
              {roomInfo.game_log && roomInfo.game_log.length > 0 ? (
                <ScrollView className="mb-4">
                  {roomInfo.game_log.map((log, index) => (
                    <Text key={index} className="mb-1 text-base text-gray-700">
                      {log}
                    </Text>
                  ))}
                </ScrollView>
              ) : (
                <Text className="mb-4 text-base text-gray-700">
                  لا يوجد سجل لعب كامل بعد.
                </Text>
              )}
              <TouchableOpacity
                className="self-center px-6 py-3 bg-blue-500 rounded-lg"
                onPress={() => setShowFullLogModal(false)}
              >
                <Text className="text-base text-white">إغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ImageBackground>
    </View>
  );
}
