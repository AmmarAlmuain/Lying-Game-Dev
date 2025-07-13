// App.tsx

import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
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
  Modal, // Import Modal for the full game log popup
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
  discardQuads, // Import the new discardQuads function
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
  // const [discardRankInput, setDiscardRankInput] = useState<string>(" "); // Removed as per discussion
  const [showFullLogModal, setShowFullLogModal] = useState<boolean>(false); // State for game log modal

  const scrollViewRef = useRef<ScrollView>(null); // Ref for auto-scrolling main content
  const fullLogScrollViewRef = useRef<ScrollView>(null); // Ref for auto-scrolling full game log modal

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
          setSelectedCards([]); // Clear selected cards on any room update

          // Logic to update declaredRankInput based on game state
          const currentTurnPlayerId =
            payload.new.turn_order_player_ids[payload.new.current_player_index];
          if (currentTurnPlayerId === localPlayer?.id) {
            // If it's my turn
            if (
              payload.new.pile_cards_count === 0 ||
              payload.new.declared_rank === null
            ) {
              setDeclaredRankInput(""); // Clear input if no rank is declared (first play, after lie/all skips)
            } else {
              setDeclaredRankInput(payload.new.declared_rank); // Pre-fill with existing declared rank
            }
          } else {
            setDeclaredRankInput(""); // If it's not my turn, clear my input.
          }
          // End logic for declaredRankInput

          // Scroll to bottom of game log on update (main scroll view)
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
          // Scroll to bottom of full log modal if open
          if (showFullLogModal) {
            setTimeout(() => {
              fullLogScrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
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
  }, [roomInfo?.id, localPlayer?.id, showFullLogModal]); // Add showFullLogModal to re-subscribe if modal state changes

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
      // setDiscardRankInput(""); // Removed as per discussion
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

  // Check if selected cards form a quadruplet for the discard button
  const isDiscardQuadrupletsButtonEnabled = useMemo(() => {
    if (selectedCards.length !== 4) {
      return false;
    }
    const firstRank = selectedCards[0].rank;
    return selectedCards.every((card) => card.rank === firstRank);
  }, [selectedCards]);

  const handleDiscardQuads = async () => {
    if (!localPlayer || !roomInfo) {
      Alert.alert("خطأ", "معلومات اللاعب أو الغرفة مفقودة.");
      return;
    }
    if (!isDiscardQuadrupletsButtonEnabled) {
      Alert.alert("خطأ", "الرجاء تحديد أربع بطاقات متطابقة للتخلص منها.");
      return;
    }
    setLoading(true);
    try {
      // Pass the rank of the selected quadruplets
      await discardQuads(
        roomInfo.id,
        localPlayer.id,
        selectedCards[0].rank // Use the rank of the first selected card
      );
      setSelectedCards([]); // Clear selection after successful discard
      Alert.alert(
        "نجاح",
        `تم التخلص من أربع بطاقات من رتبة ${selectedCards[0].rank}!`
      );
    } catch (err: any) {
      console.error("Error discarding quads:", err);
      setError(err.message || "فشل في التخلص من البطاقات.");
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

  // Determine if play button should be enabled
  const isPlayButtonEnabled =
    selectedCards.length > 0 &&
    (showDeclaredRankInput ? declaredRankInput.trim().length > 0 : true) && // Must have declaredRankInput if editable
    isMyTurn &&
    !loading;

  // Helper to count cards by rank for dynamic display (Removed as per user request)
  // const getRankCounts = useMemo(() => {
  //   const counts: { [key: string]: number } = {};
  //   if (localPlayer?.hand_cards) {
  //     localPlayer.hand_cards.forEach((card) => {
  //       counts[card.rank] = (counts[card.rank] || 0) + 1;
  //     });
  //   }
  //   return counts;
  // }, [localPlayer?.hand_cards]);

  // Get the last game log entry for the fixed display
  const lastGameLogEntry =
    roomInfo?.game_log && roomInfo.game_log.length > 0
      ? roomInfo.game_log[roomInfo.game_log.length - 1]
      : "لا توجد حركات حتى الآن.";

  // Get current player's username for fixed header
  const currentPlayerInTurn =
    roomInfo?.players?.find(
      (p: Player) =>
        p.id === roomInfo.turn_order_player_ids[roomInfo.current_player_index]
    )?.username || "غير معروف";

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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

  // Check for winner to display announcement
  const isGameCompleted = roomInfo?.status === "COMPLETED";
  const winnerPlayer = isGameCompleted
    ? roomInfo.players.find((p: Player) => p.id === roomInfo.winner_player_id)
    : null;

  return (
    <View style={styles.container}>
      {/* Fixed Top Game Info Bar */}
      {(roomInfo?.status === "IN_PROGRESS" || roomInfo?.status === "LOBBY") && (
        <View style={styles.fixedHeader}>
          {/* Turn Info - Left (only in progress) */}
          {roomInfo?.status === "IN_PROGRESS" && (
            <View style={styles.headerItem}>
              <Text style={styles.headerLabel}>الدور:</Text>
              <Text style={styles.headerValue}>
                {currentPlayerInTurn} {isMyTurn && "(دورك!)"}
              </Text>
            </View>
          )}

          {/* Pile and Your Cards - Right */}
          <View style={styles.headerRightSection}>
            <View style={styles.headerItem}>
              <Text style={styles.headerLabel}>بطاقات الكومة:</Text>
              <Text style={styles.headerValue}>
                {roomInfo?.pile_cards_count || 0}
              </Text>
            </View>
            <View style={styles.headerItem}>
              <Text style={styles.headerLabel}>أوراقك:</Text>
              <Text style={styles.headerValue}>
                {localPlayer?.card_count || 0}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Player Bubbles/Strips on the right, below the top bar */}
      {roomInfo?.id &&
        (roomInfo.status === "IN_PROGRESS" || roomInfo.status === "LOBBY") &&
        roomInfo.players && (
          <View style={styles.playerStripsContainer}>
            {roomInfo.players.map((p: Player) => (
              <View
                key={p.id}
                style={[
                  styles.playerStrip,
                  p.id === localPlayer?.id && styles.playerStripMe,
                  p.id ===
                    roomInfo.turn_order_player_ids[
                      roomInfo.current_player_index
                    ] && styles.playerStripTurn,
                ]}
              >
                <Text style={styles.playerStripName}>{p.username}</Text>
                <Text style={styles.playerStripCardCount}>
                  ({p.card_count})
                </Text>
              </View>
            ))}
          </View>
        )}

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        ref={scrollViewRef}
      >
        <Text style={styles.title}>لعبة الكذب</Text>

        {localPlayer?.id && (
          <Text style={styles.debugText}>معرف اللاعب: {localPlayer.id}</Text>
        )}

        {/* Profile Section - Only show if not in a room */}
        {!roomInfo?.id && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ملفك الشخصي</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل اسم المستخدم"
              placeholderTextColor={colors.textLight}
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
        )}

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
              placeholderTextColor={colors.textLight}
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
            {/* Room Details - Moved back here */}
            {roomInfo?.id && (
              <View style={styles.roomDetailsContainer}>
                <Text style={styles.gameDetailText}>
                  رمز الغرفة: {roomInfo.room_code}
                </Text>
                <Text style={styles.gameDetailText}>
                  أنت: {localPlayer?.is_host ? "المضيف" : "لاعب"}
                </Text>
                <Text style={styles.gameDetailText}>
                  الحالة: {roomInfo.status === "LOBBY" ? "ردهة" : "قيد اللعب"}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>حالة اللعبة</Text>

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
                {/* Announced Rank Display */}
                {roomInfo.declared_rank && (
                  <View style={styles.announcedRankContainer}>
                    <Text style={styles.announcedRankText}>
                      الرتبة المعلنة: {roomInfo.declared_rank} بواسطة{" "}
                      {
                        roomInfo.players?.find(
                          (p: Player) =>
                            p.id === roomInfo.last_played_by_player_id
                        )?.username
                      }
                    </Text>
                  </View>
                )}

                {/* Game Log - Last Entry + Full Log Button */}
                <View style={styles.gameLogSummaryContainer}>
                  <Text style={styles.sectionSubTitle}>سجل اللعبة:</Text>
                  <Text style={styles.gameLogTextSummary}>
                    {lastGameLogEntry}
                  </Text>
                  {roomInfo.game_log && roomInfo.game_log.length > 0 && (
                    <TouchableOpacity
                      style={styles.showFullLogButton}
                      onPress={() => setShowFullLogModal(true)}
                    >
                      <Text style={styles.showFullLogButtonText}>
                        عرض السجل الكامل
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Player's Hand */}
                <Text style={styles.sectionSubTitle}>
                  يديك ({localPlayer?.card_count || 0} بطاقة):
                </Text>
                {localPlayer?.hand_cards &&
                localPlayer.hand_cards.length > 0 ? (
                  <View style={styles.handContainer}>
                    {localPlayer.hand_cards.map((item, index) => (
                      <TouchableOpacity
                        key={`${item.rank}-${item.suit}-${index}`} // Unique key for each card
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
                    ))}
                  </View>
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
                        placeholderTextColor={colors.textLight}
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
                        !isPlayButtonEnabled && styles.disabledButton,
                      ]}
                      onPress={handlePlayCards}
                      disabled={!isPlayButtonEnabled}
                    >
                      <Text style={styles.buttonText}>
                        العب {selectedCards.length} بطاقة (بطاقات)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Discard Quads UI - Now just a button, enabled by selection */}
                {isMyTurn && (
                  <View style={styles.playControls}>
                    <Text style={styles.sectionSubTitle}>
                      تخلص من الرباعيات:
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.discardButton,
                        !isDiscardQuadrupletsButtonEnabled &&
                          styles.disabledButton,
                      ]}
                      onPress={handleDiscardQuads}
                      disabled={!isDiscardQuadrupletsButtonEnabled}
                    >
                      <Text style={styles.buttonText}>تخلص من الرباعيات</Text>
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

            {/* Game Completed / Winner Announcement */}
            {isGameCompleted && winnerPlayer && (
              <View style={styles.winnerContainer}>
                <Text style={styles.winnerText}>انتهت اللعبة!</Text>
                <Text style={styles.winnerText}>
                  الفائز هو: {winnerPlayer.username} 🎉
                </Text>
                <TouchableOpacity
                  style={[styles.button, styles.startButton]}
                  onPress={() => {
                    // Reset game state to allow new game or return to lobby
                    setRoomInfo(null);
                    setLocalPlayer((prev) =>
                      prev ? { ...prev, hand_cards: [], card_count: 0 } : null
                    );
                    setUsernameInput(""); // Clear username input to allow new entry
                    setRoomCodeInput("");
                    setSelectedCards([]);
                    setDeclaredRankInput("");
                  }}
                >
                  <Text style={styles.buttonText}>العودة إلى الردهة</Text>
                </TouchableOpacity>
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

      {/* Full Game Log Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFullLogModal}
        onRequestClose={() => setShowFullLogModal(false)}
      >
        <View style={styles.fullLogModalContainer}>
          <View style={styles.fullLogModalContent}>
            <Text style={styles.fullLogModalTitle}>سجل اللعبة الكامل</Text>
            <ScrollView
              style={styles.fullLogScrollView}
              contentContainerStyle={styles.fullLogScrollViewContent}
              ref={fullLogScrollViewRef}
            >
              {roomInfo?.game_log && roomInfo.game_log.length > 0 ? (
                roomInfo.game_log.map((log: string, index: number) => (
                  <Text key={index} style={styles.fullLogText}>
                    {log}
                  </Text>
                ))
              ) : (
                <Text style={styles.fullLogText}>لا توجد حركات مسجلة بعد.</Text>
              )}
              {/* Added padding at the bottom of the scrollable area */}
              <View style={styles.fullLogPadding}></View>
            </ScrollView>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowFullLogModal(false)}
            >
              <Text style={styles.closeModalButtonText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- New Color Palette (Purple/Grey Theme) ---
const colors = {
  background: "#2C2A3A", // Dark purple-grey background
  cardBackground: "#3A384A", // Slightly lighter purple-grey for sections/cards
  cardBorder: "#5A586A", // Darker border for elements
  primary: "#8A2BE2", // BlueViolet - Primary purple
  secondary: "#9370DB", // MediumPurple - Lighter purple for secondary actions
  danger: "#DC143C", // Crimson - Red for destructive actions
  textPrimary: "#E0E0E0", // Light grey for main text
  textSecondary: "#A0A0A0", // Muted grey for secondary text
  textLight: "#B0B0B0", // Even lighter for placeholders
  shadow: "rgba(0,0,0,0.6)", // Stronger shadow for depth
  disabled: "#4A485A", // Darker disabled button
  accent: "#FFD700", // Gold accent for titles/selected items (retained for pop)
  modalBackground: "rgba(0,0,0,0.7)", // Dark overlay for modal
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 0, // Removed padding top here, handled by fixedHeader and scrollViewContent
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 100, // Add padding to account for fixed header
    paddingBottom: 30,
    width: "100%",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: colors.textPrimary,
  },
  title: {
    fontSize: width * 0.09, // Responsive title size
    fontWeight: "bold",
    color: colors.accent, // Gold color for title
    marginBottom: width * 0.08, // Responsive margin
    textShadowColor: colors.shadow,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  message: {
    fontSize: width * 0.04,
    color: colors.textPrimary,
    marginBottom: width * 0.05,
    textAlign: "center",
    paddingHorizontal: width * 0.05,
  },
  debugText: {
    fontSize: width * 0.03,
    color: colors.textSecondary,
    marginBottom: width * 0.02,
    textAlign: "center",
  },
  section: {
    width: width * 0.9, // 90% of screen width
    maxWidth: 450,
    backgroundColor: colors.cardBackground, // Darker background for sections
    borderRadius: 15,
    padding: width * 0.06, // Responsive padding
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 }, // Deeper shadow
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
    marginBottom: width * 0.06, // Responsive space between sections
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionTitle: {
    fontSize: width * 0.06, // Responsive section titles
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: width * 0.05,
    textShadowColor: colors.shadow,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  sectionSubTitle: {
    fontSize: width * 0.045, // Responsive sub-titles
    fontWeight: "600",
    color: colors.secondary, // Lighter purple for sub-titles
    marginTop: width * 0.04,
    marginBottom: width * 0.025,
    textAlign: "right", // For Arabic text
    width: "100%",
  },
  input: {
    width: "100%",
    height: width * 0.12, // Responsive input height
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: width * 0.04, // Responsive padding
    marginBottom: width * 0.04,
    fontSize: width * 0.04, // Responsive font size
    backgroundColor: colors.background, // Match overall background
    color: colors.textPrimary,
    textAlign: "right", // For Arabic input
  },
  button: {
    width: "100%",
    paddingVertical: width * 0.04, // Responsive padding
    backgroundColor: colors.primary, // Primary purple button
    borderRadius: 10,
    alignItems: "center",
    marginBottom: width * 0.03,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: "#FFFFFF", // White text for buttons
    fontSize: width * 0.045, // Responsive font size
    fontWeight: "700",
  },
  disabledButton: {
    backgroundColor: colors.disabled, // Darker disabled color
    shadowOpacity: 0.1,
    elevation: 2,
  },
  divider: {
    width: "80%",
    height: 1,
    backgroundColor: colors.cardBorder, // Match border color
    marginVertical: width * 0.06, // Responsive vertical space
  },
  roomCodeText: {
    fontSize: width * 0.055, // Responsive size
    fontWeight: "bold",
    color: colors.accent, // Gold for room code
    marginBottom: width * 0.04,
    textAlign: "center",
  },
  playerInfo: {
    fontSize: width * 0.04,
    color: colors.textPrimary,
    marginBottom: width * 0.02,
    textAlign: "center",
  },
  playerListItem: {
    fontSize: width * 0.035,
    color: colors.textSecondary,
    textAlign: "right", // For Arabic text
    width: "100%",
    paddingRight: width * 0.02,
    paddingVertical: width * 0.008,
  },
  startButton: {
    backgroundColor: colors.primary, // Keep primary purple
    marginTop: width * 0.06,
    shadowColor: colors.primary,
  },
  leaveButton: {
    backgroundColor: colors.danger, // Red for leave
    marginTop: width * 0.06,
    shadowColor: colors.danger,
  },
  gameInProgressInfo: {
    marginTop: width * 0.06,
    width: "100%",
    paddingTop: width * 0.05,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  turnInfo: {
    fontSize: width * 0.065,
    fontWeight: "bold",
    color: colors.secondary, // Lighter purple for turn info
    marginBottom: width * 0.05,
    textAlign: "center",
    textShadowColor: colors.shadow,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gameDetailText: {
    fontSize: width * 0.04,
    color: colors.textPrimary,
    marginBottom: width * 0.01,
    textAlign: "right",
  },
  gameLogSummaryContainer: {
    width: "100%",
    marginTop: width * 0.04,
    padding: width * 0.03,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "flex-end", // Align text to the right for Arabic
  },
  gameLogTextSummary: {
    fontSize: width * 0.038,
    color: colors.textPrimary,
    marginBottom: width * 0.02,
    textAlign: "right",
    width: "100%",
  },
  showFullLogButton: {
    backgroundColor: colors.secondary,
    paddingVertical: width * 0.02,
    paddingHorizontal: width * 0.04,
    borderRadius: 8,
    marginTop: width * 0.02,
    alignSelf: "center", // Center the button
  },
  showFullLogButtonText: {
    color: "#FFFFFF",
    fontSize: width * 0.035,
    fontWeight: "bold",
  },
  handContainer: {
    flexDirection: "row",
    flexWrap: "wrap", // Cards will wrap to the next line
    justifyContent: "center",
    marginTop: width * 0.04,
    paddingVertical: width * 0.02,
    width: "100%",
  },
  cardRow: {
    justifyContent: "center", // Center cards in each row
  },
  card: {
    width: width * 0.18, // Responsive card width
    height: width * 0.25, // Aspect ratio for cards
    backgroundColor: "#FFFFFF", // White card background
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    marginHorizontal: width * 0.015, // Responsive margin
    marginBottom: width * 0.03, // Add vertical margin for wrapping
    justifyContent: "space-between", // Space out rank and suit
    alignItems: "center",
    paddingVertical: width * 0.025, // Responsive padding
    shadowColor: colors.shadow,
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  selectedCard: {
    borderColor: colors.accent, // Gold border for selected
    borderWidth: 3,
    backgroundColor: "#FFFACD", // Light goldenrod yellow for selected
  },
  cardRankText: {
    fontSize: width * 0.04, // Responsive font size, slightly smaller
    fontWeight: "bold",
    color: "#333",
  },
  cardSuitText: {
    fontSize: width * 0.035, // Responsive font size, slightly smaller
    color: "#555",
  },
  noCardsText: {
    fontSize: width * 0.04,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: width * 0.04,
  },
  playControls: {
    width: "100%",
    marginTop: width * 0.06,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: width * 0.05,
  },
  declaredRankFixedText: {
    width: "100%",
    height: width * 0.12,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: width * 0.04,
    marginBottom: width * 0.04,
    fontSize: width * 0.04,
    backgroundColor: colors.background,
    color: colors.accent, // Gold for fixed declared rank
    textAlign: "center",
    lineHeight: width * 0.12, // Center text vertically
    fontWeight: "bold",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: width * 0.05,
  },
  callLieButton: {
    backgroundColor: colors.secondary, // MediumPurple for call lie
    shadowColor: colors.secondary,
    flex: 1,
    marginRight: width * 0.02,
  },
  skipTurnButton: {
    backgroundColor: colors.textSecondary, // Muted grey for skip turn
    shadowColor: colors.textSecondary,
    flex: 1,
    marginLeft: width * 0.02,
  },
  discardButton: {
    backgroundColor: colors.primary, // Primary purple for discard
    shadowColor: colors.primary,
    marginTop: width * 0.025,
  },
  errorText: {
    fontSize: width * 0.045,
    color: colors.danger, // Red for errors
    textAlign: "center",
    marginBottom: width * 0.05,
  },
  winnerContainer: {
    marginTop: width * 0.08,
    padding: width * 0.05,
    backgroundColor: colors.primary, // Primary purple for winner
    borderRadius: 15,
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    width: "90%",
  },
  winnerText: {
    fontSize: width * 0.07,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: width * 0.025,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Modal Styles
  fullLogModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.modalBackground,
  },
  fullLogModalContent: {
    width: "90%",
    height: "70%",
    backgroundColor: colors.cardBackground,
    borderRadius: 15,
    padding: width * 0.05,
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 20,
  },
  fullLogModalTitle: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    color: colors.accent,
    marginBottom: width * 0.04,
  },
  fullLogScrollView: {
    width: "100%",
    flex: 1, // Allow scroll view to take available height
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    padding: width * 0.03,
    backgroundColor: colors.background,
  },
  fullLogScrollViewContent: {
    flexGrow: 1, // Enable scrolling
    justifyContent: "flex-end", // Stick content to bottom
  },
  fullLogText: {
    fontSize: width * 0.038,
    color: colors.textPrimary,
    marginBottom: width * 0.015,
    textAlign: "right",
  },
  fullLogPadding: {
    // Added for padding at the bottom of the log
    height: width * 0.05, // Responsive padding
  },
  closeModalButton: {
    marginTop: width * 0.05,
    backgroundColor: colors.primary,
    paddingVertical: width * 0.03,
    paddingHorizontal: width * 0.06,
    borderRadius: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  closeModalButtonText: {
    color: "#FFFFFF",
    fontSize: width * 0.04,
    fontWeight: "bold",
  },
  // Fixed Header Styles
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80, // Fixed height for the header
    backgroundColor: colors.cardBackground, // Use a slightly lighter background
    flexDirection: "row",
    justifyContent: "space-between", // Space between items
    alignItems: "center",
    paddingHorizontal: width * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    zIndex: 10, // Ensure it stays on top
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  headerItem: {
    alignItems: "center",
    flex: 1, // Distribute space
  },
  headerLabel: {
    fontSize: width * 0.035,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  headerValue: {
    fontSize: width * 0.045,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  headerValueSmall: {
    // Smaller text for room details
    fontSize: width * 0.03,
    color: colors.textPrimary,
    textAlign: "center",
  },
  headerRoomDetails: {
    flex: 2, // Give more space to room details
    alignItems: "flex-start", // Align to left
  },
  headerRightSection: {
    flex: 2, // Give more space to pile and your cards
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  // Player Strips Styles
  playerStripsContainer: {
    position: "absolute",
    top: 90, // Below the fixed header
    right: width * 0.02, // Right side
    flexDirection: "column", // Stack vertically
    alignItems: "flex-end", // Align strips to the right
    zIndex: 9, // Below the header but above main content
  },
  playerStrip: {
    backgroundColor: colors.secondary, // Use secondary color for strips
    paddingVertical: width * 0.015,
    paddingHorizontal: width * 0.03,
    borderRadius: 15,
    marginBottom: width * 0.015, // Space between strips
    flexDirection: "row",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  playerStripMe: {
    backgroundColor: colors.primary, // Highlight for current player
    borderColor: colors.accent,
    borderWidth: 1,
  },
  playerStripTurn: {
    backgroundColor: colors.accent, // Highlight for current turn
    borderColor: colors.primary,
    borderWidth: 1,
  },
  playerStripName: {
    color: "#FFFFFF",
    fontSize: width * 0.035,
    fontWeight: "bold",
    marginRight: width * 0.01,
  },
  playerStripCardCount: {
    color: "#FFFFFF",
    fontSize: width * 0.03,
  },
  announcedRankContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: width * 0.04,
    marginTop: width * 0.04,
    marginBottom: width * 0.04,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  announcedRankText: {
    fontSize: width * 0.045,
    fontWeight: "bold",
    color: colors.accent,
    textAlign: "center",
  },
  // New style for room details container when moved back
  roomDetailsContainer: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: width * 0.04,
    marginBottom: width * 0.04,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "flex-end", // Align text to the right for Arabic
  },
});
