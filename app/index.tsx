// App.tsx
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";

// Import services
import { initPlayerSession, changePlayerUsername } from "../services/player";
import {
  createRoom,
  joinRoom,
  startGame,
  playCards,
  skipTurn,
  callLie,
} from "../services/room";
import supabase from "../services/supabase";

// Card and Player interfaces for type safety
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

const ranks = [
  "ACE",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "JACK",
  "QUEEN",
  "KING",
];
const { width } = Dimensions.get("window"); // Get screen width for responsive sizing

export default function App() {
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [declaredRankInput, setDeclaredRankInput] = useState<string>("");

  const scrollViewRef = useRef<ScrollView>(null); // Ref for auto-scrolling game log

  // --- Initial Setup: Player Session and Room Re-joining ---
  useEffect(() => {
    const setupInitialState = async () => {
      try {
        setLoading(true);
        setError(null);

        const initialPlayerSession = await initPlayerSession();
        setLocalPlayer({
          id: initialPlayerSession.id,
          username: initialPlayerSession.name || "",
          is_host: false,
          hand_cards: [],
          card_count: 0,
        });
        setUsernameInput(initialPlayerSession.name || "");
        console.log("Player Initialized (Initial Set):", initialPlayerSession);

        const { data: rooms, error: roomFetchError } = await supabase
          .from("room")
          .select("*")
          .contains("players", [{ id: initialPlayerSession.id }]);

        if (roomFetchError) {
          console.warn(
            "Error checking for existing room:",
            roomFetchError.message
          );
        } else if (rooms && rooms.length > 0) {
          const existingRoom = rooms[0];
          setRoomInfo(existingRoom);
          setRoomCodeInput(existingRoom.room_code);
          const playerInRoom = existingRoom.players.find(
            (p: Player) => p.id === initialPlayerSession.id
          );
          if (playerInRoom) {
            setLocalPlayer(playerInRoom);
          }
          console.log("Rejoined existing room:", existingRoom);
        }
      } catch (err: any) {
        console.error("Error during initial setup:", err);
        setError(err.message || "حدث خطأ غير معروف أثناء الإعداد.");
      } finally {
        setLoading(false);
      }
    };

    setupInitialState();
  }, []);

  // --- Realtime Subscription for Room Updates ---
  useEffect(() => {
    if (!roomInfo?.id) return;

    const roomChannel = supabase
      .channel(`room:${roomInfo.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room",
          filter: `id=eq.${roomInfo.id}`,
        },
        (payload) => {
          console.log("Realtime Room Update Received:", payload.new);
          setRoomInfo(payload.new);

          const updatedLocalPlayer = payload.new.players.find(
            (p: Player) => p.id === localPlayer?.id
          );
          if (updatedLocalPlayer) {
            setLocalPlayer(updatedLocalPlayer);
          }
          setSelectedCards([]);
          // Only clear declared rank input if the new room state explicitly nulls it
          if (payload.new.declared_rank === null) {
            setDeclaredRankInput("");
          }
          // Scroll to bottom of game log on update
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "room",
          filter: `id=eq.${roomInfo.id}`,
        },
        () => {
          console.log("Room Deleted.");
          setRoomInfo(null);
          setLocalPlayer(null);
          setRoomCodeInput("");
          setSelectedCards([]);
          setDeclaredRankInput("");
          Alert.alert("تم حذف الغرفة", "لقد غادر المضيف أو تم حذف الغرفة.");
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [roomInfo?.id, localPlayer?.id]);

  // --- Handlers for UI Actions ---

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

  const handleCreateRoom = async () => {
    if (!usernameInput.trim()) {
      Alert.alert("خطأ", "الرجاء إدخال اسم المستخدم.");
      return;
    }
    if (!localPlayer?.id) {
      Alert.alert("خطأ", "معرف اللاعب غير متاح. الرجاء إعادة تشغيل التطبيق.");
      return;
    }

    setLoading(true);
    try {
      const { room: newRoom, player: hostPlayerRecord } = await createRoom(
        localPlayer.id,
        usernameInput.trim()
      );
      setRoomInfo(newRoom);
      setLocalPlayer(hostPlayerRecord);
      setRoomCodeInput(newRoom.room_code);
    } catch (err: any) {
      console.error("Error creating room:", err);
      setError(err.message || "فشل في إنشاء الغرفة.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!usernameInput.trim() || !roomCodeInput.trim()) {
      Alert.alert("خطأ", "الرجاء إدخال اسم المستخدم ورمز الغرفة.");
      return;
    }
    if (!localPlayer?.id) {
      Alert.alert("خطأ", "معرف اللاعب غير متاح. الرجاء إعادة تشغيل التطبيق.");
      return;
    }

    setLoading(true);
    try {
      const { room: joinedRoom, player: joinedPlayerRecord } = await joinRoom(
        roomCodeInput.trim(),
        localPlayer.id,
        usernameInput.trim()
      );
      setRoomInfo(joinedRoom);
      setLocalPlayer(joinedPlayerRecord);
    } catch (err: any) {
      console.error("Error joining room:", err);
      setError(err.message || "فشل في الانضمام إلى الغرفة.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomInfo || !localPlayer) {
      setError("معلومات الغرفة أو اللاعب غير متوفرة.");
      return;
    }
    if (roomInfo.host_player_id !== localPlayer.id) {
      Alert.alert("خطأ", "المضيف فقط يمكنه بدء اللعبة.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await startGame(roomInfo.id, localPlayer.id);
    } catch (err: any) {
      console.error("Error starting game:", err);
      setError(err.message || "فشل في بدء اللعبة.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!localPlayer || !roomInfo) return;
    setLoading(true);
    try {
      if (localPlayer.is_host) {
        const { error: roomDeleteError } = await supabase
          .from("room")
          .delete()
          .eq("id", roomInfo.id);
        if (roomDeleteError) throw roomDeleteError;
        Alert.alert(
          "تم حذف الغرفة",
          "لقد غادرت وتم حذف الغرفة لأنك كنت المضيف."
        );
      } else {
        const { data: currentRoom, error: fetchRoomError } = await supabase
          .from("room")
          .select("players, game_log")
          .eq("id", roomInfo.id)
          .single();

        if (fetchRoomError) throw fetchRoomError;

        const updatedPlayers = currentRoom.players.filter(
          (p: any) => p.id !== localPlayer.id
        );
        const leaveMessage = `${localPlayer.username} غادر الغرفة.`;
        const updatedGameLog = [...currentRoom.game_log, leaveMessage];

        const { error: roomUpdateError } = await supabase
          .from("room")
          .update({ players: updatedPlayers, game_log: updatedGameLog })
          .eq("id", roomInfo.id);

        if (roomUpdateError) throw roomUpdateError;

        Alert.alert("غادرت الغرفة", "لقد غادرت الغرفة بنجاح.");

        if (updatedPlayers.length === 0) {
          const { error: emptyRoomDeleteError } = await supabase
            .from("room")
            .delete()
            .eq("id", roomInfo.id);
          if (emptyRoomDeleteError)
            console.error(
              "Error deleting empty room:",
              emptyRoomDeleteError.message
            );
        }
      }

      setLocalPlayer((prev) =>
        prev ? { ...prev, is_host: false, hand_cards: [], card_count: 0 } : null
      );
      setRoomInfo(null);
      setRoomCodeInput("");
      setSelectedCards([]);
      setDeclaredRankInput("");
    } catch (err: any) {
      console.error("Error leaving room:", err.message);
      setError(err.message || "خطأ في مغادرة الغرفة.");
    } finally {
      setLoading(false);
    }
  };

  const handleCardPress = useCallback((card: Card) => {
    setSelectedCards((prevSelected) => {
      const isSelected = prevSelected.some(
        (sc) => sc.rank === card.rank && sc.suit === card.suit
      );
      if (isSelected) {
        return prevSelected.filter(
          (sc) => sc.rank !== card.rank || sc.suit !== card.suit
        );
      } else {
        if (prevSelected.length < 4) {
          return [...prevSelected, card];
        } else {
          Alert.alert("الحد الأقصى", "يمكنك اختيار 4 بطاقات كحد أقصى.");
          return prevSelected;
        }
      }
    });
  }, []);

  const handlePlayCards = async () => {
    if (!localPlayer || !roomInfo) {
      Alert.alert("خطأ", "معلومات اللاعب أو الغرفة مفقودة.");
      return;
    }
    if (selectedCards.length === 0) {
      Alert.alert("خطأ", "الرجاء تحديد بطاقة واحدة على الأقل للعب.");
      return;
    }
    if (selectedCards.length > 4) {
      Alert.alert("خطأ", "يمكنك لعب 4 بطاقات كحد أقصى.");
      return;
    }

    // Determine if declaredRankInput is required or fixed
    const isDeclaredRankRequired =
      roomInfo.pile_cards_count === 0 || roomInfo.declared_rank === null;

    if (
      isDeclaredRankRequired &&
      (!declaredRankInput.trim() ||
        !ranks.includes(declaredRankInput.toUpperCase()))
    ) {
      Alert.alert("خطأ", `الرجاء إعلان رتبة صالحة: ${ranks.join(", ")}`);
      return;
    }

    // If not declared rank required, use the existing declared rank
    const finalDeclaredRank = isDeclaredRankRequired
      ? declaredRankInput.toUpperCase()
      : roomInfo.declared_rank;

    setLoading(true);
    try {
      await playCards(
        roomInfo.id,
        localPlayer.id,
        selectedCards,
        finalDeclaredRank
      );
      setSelectedCards([]);
      // Declared rank input is cleared by the useEffect if roomInfo.declared_rank becomes null
    } catch (err: any) {
      console.error("Error playing cards:", err);
      setError(err.message || "فشل في لعب البطاقات.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipTurn = async () => {
    if (!localPlayer || !roomInfo) return;
    setLoading(true);
    try {
      await skipTurn(roomInfo.id, localPlayer.id);
      Alert.alert("تم تخطي الدور", "لقد تخطيت دورك.");
    } catch (err: any) {
      console.error("Error skipping turn:", err);
      setError(err.message || "فشل في تخطي الدور.");
    } finally {
      setLoading(false);
    }
  };

  const handleCallLie = async () => {
    if (!localPlayer || !roomInfo) return;
    setLoading(true);
    try {
      await callLie(roomInfo.id, localPlayer.id);
      Alert.alert("تم كشف الكذب!", "لقد تم كشف الكذب.");
    } catch (err: any) {
      console.error("Error calling lie:", err);
      setError(err.message || "فشل في كشف الكذب.");
    } finally {
      setLoading(false);
    }
  };

  const isMyTurn =
    roomInfo &&
    localPlayer &&
    roomInfo.status === "IN_PROGRESS" &&
    roomInfo.turn_order_player_ids[roomInfo.current_player_index] ===
      localPlayer.id;

  const canCallLie =
    isMyTurn &&
    roomInfo &&
    roomInfo.status === "IN_PROGRESS" &&
    roomInfo.last_played_by_player_id &&
    roomInfo.last_played_by_player_id !== localPlayer.id &&
    roomInfo.pile_cards_count > 0;

  const canSkipTurn = isMyTurn && roomInfo && roomInfo.pile_cards_count > 0;

  // Determine if the declared rank input should be editable or displayed as fixed
  const showDeclaredRankInput =
    roomInfo?.pile_cards_count === 0 || roomInfo?.declared_rank === null;

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>خطأ: {error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => window.location.reload()}
        >
          <Text style={styles.buttonText}>إعادة تحميل التطبيق</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        ref={scrollViewRef}
      >
        <Text style={styles.title}>لعبة الكذب</Text>

        {localPlayer?.id && (
          <Text style={styles.debugText}>معرف اللاعب: {localPlayer.id}</Text>
        )}

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملفك الشخصي</Text>
          <TextInput
            style={styles.input}
            placeholder="أدخل اسم المستخدم"
            value={usernameInput}
            onChangeText={setUsernameInput}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.disabledButton]}
            onPress={handleChangeUsername}
            disabled={loading}
          >
            <Text style={styles.buttonText}>تغيير اسم المستخدم</Text>
          </TouchableOpacity>
        </View>

        {/* Room Lobby / Details */}
        {!roomInfo?.id ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ردهة الغرفة</Text>
            <TouchableOpacity
              style={[
                styles.button,
                (loading || !localPlayer?.id) && styles.disabledButton,
              ]}
              onPress={handleCreateRoom}
              disabled={loading || !localPlayer?.id}
            >
              <Text style={styles.buttonText}>إنشاء غرفة جديدة</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TextInput
              style={styles.input}
              placeholder="أدخل رمز الغرفة للانضمام"
              value={roomCodeInput}
              onChangeText={setRoomCodeInput}
              autoCapitalize="characters"
              editable={!loading && !!localPlayer?.id}
            />
            <TouchableOpacity
              style={[
                styles.button,
                (loading || !localPlayer?.id) && styles.disabledButton,
              ]}
              onPress={handleJoinRoom}
              disabled={loading || !localPlayer?.id}
            >
              <Text style={styles.buttonText}>الانضمام إلى الغرفة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>تفاصيل الغرفة</Text>
            <Text style={styles.roomCodeText}>
              رمز الغرفة: {roomInfo.room_code}
            </Text>
            <Text style={styles.playerInfo}>
              أنت {localPlayer?.is_host ? "المضيف" : "لاعب"}
            </Text>
            <Text style={styles.playerInfo}>
              حالة الغرفة:{" "}
              {roomInfo.status === "LOBBY" ? "في الردهة" : "قيد اللعب"}
            </Text>

            {roomInfo.status === "IN_PROGRESS" && (
              <Text style={styles.turnInfo}>
                الدور الحالي:{" "}
                {
                  roomInfo.players?.find(
                    (p: Player) =>
                      p.id ===
                      roomInfo.turn_order_player_ids[
                        roomInfo.current_player_index
                      ]
                  )?.username
                }
                {isMyTurn && " (دورك!)"}
              </Text>
            )}

            <Text style={styles.sectionSubTitle}>
              اللاعبون في الغرفة ({roomInfo.players?.length || 0}):
            </Text>
            {roomInfo.players &&
              roomInfo.players.map((p: Player) => (
                <Text key={p.id} style={styles.playerListItem}>
                  - {p.username} {p.id === localPlayer?.id ? "(أنت)" : ""}{" "}
                  {p.is_host ? "(المضيف)" : ""}{" "}
                  {roomInfo.status === "IN_PROGRESS" &&
                    `(${p.card_count} بطاقة)`}
                </Text>
              ))}

            {roomInfo.status === "LOBBY" && localPlayer?.is_host && (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.startButton,
                  (roomInfo.players?.length < 2 ||
                    roomInfo.players?.length > 4 ||
                    loading) &&
                    styles.disabledButton,
                ]}
                onPress={handleStartGame}
                disabled={
                  roomInfo.players?.length < 2 ||
                  roomInfo.players?.length > 4 ||
                  loading
                }
              >
                <Text style={styles.buttonText}>
                  بدء اللعبة ({roomInfo.players?.length}/4)
                </Text>
              </TouchableOpacity>
            )}

            {/* Game In Progress UI */}
            {roomInfo.status === "IN_PROGRESS" && (
              <View style={styles.gameInProgressInfo}>
                <Text style={styles.sectionSubTitle}>حالة اللعبة:</Text>
                <Text style={styles.gameDetailText}>
                  بطاقات الكومة: {roomInfo.pile_cards_count}
                </Text>
                {roomInfo.declared_rank && (
                  <Text style={styles.gameDetailText}>
                    آخر رتبة معلنة: {roomInfo.declared_rank} بواسطة{" "}
                    {
                      roomInfo.players?.find(
                        (p: Player) =>
                          p.id === roomInfo.last_played_by_player_id
                      )?.username
                    }
                  </Text>
                )}

                {/* Game Log */}
                <Text style={styles.sectionSubTitle}>سجل اللعبة:</Text>
                <View>
                  {roomInfo.game_log &&
                    roomInfo.game_log.map((log: string, index: number) => (
                      <Text key={index} style={styles.gameLogText}>
                        {log}
                      </Text>
                    ))}
                </View>

                {/* Player's Hand */}
                <Text style={styles.sectionSubTitle}>
                  يديك ({localPlayer?.card_count || 0} بطاقة):
                </Text>
                {localPlayer?.hand_cards &&
                localPlayer.hand_cards.length > 0 ? (
                  <FlatList
                    data={localPlayer.hand_cards}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.card,
                          selectedCards.some(
                            (sc) =>
                              sc.rank === item.rank && sc.suit === item.suit
                          ) && styles.selectedCard,
                        ]}
                        onPress={() => isMyTurn && handleCardPress(item)}
                        disabled={!isMyTurn || loading}
                      >
                        <Text style={styles.cardRankText}>{item.rank}</Text>
                        <Text style={styles.cardSuitText}>
                          {item.suit === "HEARTS"
                            ? "❤️"
                            : item.suit === "DIAMONDS"
                            ? "♦️"
                            : item.suit === "CLUBS"
                            ? "♣️"
                            : "♠️"}
                        </Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item, index) =>
                      `${item.rank}-${item.suit}-${index}`
                    }
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.handContainer}
                  />
                ) : (
                  <Text style={styles.noCardsText}>
                    لا توجد بطاقات في اليد.
                  </Text>
                )}

                {/* Play Cards UI */}
                {isMyTurn && (
                  <View style={styles.playControls}>
                    <Text style={styles.sectionSubTitle}>العب البطاقات:</Text>
                    {showDeclaredRankInput ? (
                      <TextInput
                        style={styles.input}
                        placeholder="أعلن الرتبة (مثال: ACE, KING)"
                        value={declaredRankInput}
                        onChangeText={setDeclaredRankInput}
                        autoCapitalize="characters"
                        editable={!loading}
                      />
                    ) : (
                      <Text style={styles.declaredRankFixedText}>
                        الرتبة المعلنة: {roomInfo.declared_rank}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.button,
                        (selectedCards.length === 0 ||
                          (showDeclaredRankInput &&
                            !declaredRankInput.trim()) ||
                          loading) &&
                          styles.disabledButton,
                      ]}
                      onPress={handlePlayCards}
                      disabled={
                        selectedCards.length === 0 ||
                        (showDeclaredRankInput && !declaredRankInput.trim()) ||
                        loading
                      }
                    >
                      <Text style={styles.buttonText}>
                        العب {selectedCards.length} بطاقة (بطاقات)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Call Lie / Skip Turn Buttons */}
                {isMyTurn && (
                  <View style={styles.actionButtonsContainer}>
                    {canCallLie && (
                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.callLieButton,
                          loading && styles.disabledButton,
                        ]}
                        onPress={handleCallLie}
                        disabled={loading}
                      >
                        <Text style={styles.buttonText}>اكشف الكذب!</Text>
                      </TouchableOpacity>
                    )}
                    {canSkipTurn && (
                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.skipTurnButton,
                          loading && styles.disabledButton,
                        ]}
                        onPress={handleSkipTurn}
                        disabled={loading}
                      >
                        <Text style={styles.buttonText}>تخطي الدور</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                styles.leaveButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleLeaveRoom}
              disabled={loading}
            >
              <Text style={styles.buttonText}>مغادرة الغرفة</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a2a3a", // Darker background for elegance
    paddingTop: 40,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a2a3a",
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 30,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: "#E0E0E0",
  },
  title: {
    fontSize: 38,
    fontWeight: "bold",
    color: "#FFD700", // Gold color for title
    marginBottom: 30,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
    fontFamily: "Arial", // A common, clean font
  },
  message: {
    fontSize: 16,
    color: "#87CEEB", // Sky blue for messages
    marginBottom: 20,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  debugText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 10,
    textAlign: "center",
  },
  section: {
    width: width * 0.9, // 90% of screen width
    maxWidth: 450,
    backgroundColor: "#2b3b4b", // Slightly lighter dark for sections
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 15,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#4a90e2", // Subtle border
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 20,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  sectionSubTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ADD8E6", // Light blue for subtitles
    marginTop: 15,
    marginBottom: 10,
    textAlign: "right", // For Arabic text
    width: "100%",
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#5a6b7b", // Darker border for inputs
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#3a4a5a", // Darker background for inputs
    color: "#E0E0E0", // Light text color
    textAlign: "right", // For Arabic input
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    backgroundColor: "#4A90E2", // Primary blue button
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    transitionDuration: "0.3s", // For web-like hover effect
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  disabledButton: {
    backgroundColor: "#607d8b", // Muted grey for disabled
    shadowOpacity: 0.1,
    elevation: 2,
  },
  divider: {
    width: "80%",
    height: 1,
    backgroundColor: "#5a6b7b",
    marginVertical: 25,
  },
  roomCodeText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 15,
    textAlign: "center",
  },
  playerInfo: {
    fontSize: 16,
    color: "#E0E0E0",
    marginBottom: 8,
    textAlign: "center",
  },
  playerListItem: {
    fontSize: 15,
    color: "#B0C4DE", // Light steel blue
    textAlign: "right",
    width: "100%",
    paddingRight: 10,
    paddingVertical: 3,
  },
  startButton: {
    backgroundColor: "#28a745", // Green for start
    shadowColor: "#28a745",
    marginTop: 25,
  },
  leaveButton: {
    backgroundColor: "#dc3545", // Red for leave
    shadowColor: "#dc3545",
    marginTop: 25,
  },
  gameInProgressInfo: {
    marginTop: 25,
    width: "100%",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#5a6b7b",
  },
  turnInfo: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#87CEEB",
    marginBottom: 20,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gameDetailText: {
    fontSize: 16,
    color: "#E0E0E0",
    marginBottom: 5,
    textAlign: "right",
  },
  gameLogContainer: {
    maxHeight: 180, // Increased height for more log visibility
    width: "100%",
    backgroundColor: "#3a4a5a",
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#5a6b7b",
    overflow: "scroll",
  },
  gameLogContent: {
    paddingBottom: 5, // Ensure scroll to end works well
  },
  gameLogText: {
    fontSize: 14,
    color: "#B0C4DE",
    marginBottom: 5,
    textAlign: "right",
  },
  handContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 15,
    paddingVertical: 10,
    width: "100%",
  },
  card: {
    width: width * 0.18, // Responsive card width
    height: width * 0.25, // Aspect ratio for cards
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ccc",
    margin: width * 0.015, // Responsive margin
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  selectedCard: {
    borderColor: "#FFD700", // Gold border for selected
    borderWidth: 3,
    backgroundColor: "#FFFACD", // Light goldenrod yellow
  },
  cardRankText: {
    fontSize: width * 0.05, // Responsive font size
    fontWeight: "bold",
    color: "#333",
  },
  cardSuitText: {
    fontSize: width * 0.04, // Responsive font size
    color: "#555",
  },
  noCardsText: {
    fontSize: 16,
    color: "#B0C4DE",
    textAlign: "center",
    marginTop: 15,
  },
  playControls: {
    width: "100%",
    marginTop: 25,
    borderTopWidth: 1,
    borderTopColor: "#5a6b7b",
    paddingTop: 20,
  },
  declaredRankFixedText: {
    width: "100%",
    height: 50,
    borderColor: "#5a6b7b",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#3a4a5a",
    color: "#FFD700", // Gold for fixed declared rank
    textAlign: "center",
    lineHeight: 50,
    fontWeight: "bold",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  callLieButton: {
    backgroundColor: "#FFC107", // Amber for call lie
    shadowColor: "#FFC107",
    flex: 1,
    marginRight: 8,
  },
  skipTurnButton: {
    backgroundColor: "#6c757d", // Dark grey for skip turn
    shadowColor: "#6c757d",
    flex: 1,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 18,
    color: "#FF6347", // Tomato red for errors
    textAlign: "center",
    marginBottom: 20,
  },
});
