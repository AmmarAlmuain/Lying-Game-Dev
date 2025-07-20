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
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";

import { initPlayerSession } from "../services/player";
import {
  createRoom,
  joinRoom,
  startGame,
  playCards,
  skipTurn,
  callLie,
  discardQuads,
  leaveRoom,
} from "../services/room";
import supabase from "../services/supabase";

import WelcomeScreen from "./screens/WelcomeScreen";
import LobbySelectionScreen from "./screens/LobbySelectionScreen";
import GameScreen from "./screens/GameScreen";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [roomInfo, setRoomInfo] = useState<Room | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [currentPage, setCurrentPage] = useState<CurrentPage>("welcome");

  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [declaredRankInput, setDeclaredRankInput] = useState<string>("");
  const [showFullLogModal, setShowFullLogModal] = useState(false);

  const roomSubscription = useRef<any>(null);
  const playerSubscription = useRef<any>(null);
  const initializedPlayerSession = useRef(false);

  useEffect(() => {
    async function initialize() {
      if (initializedPlayerSession.current) {
        return;
      }
      initializedPlayerSession.current = true;
      setLoading(true);
      setError(null);
      try {
        const { id, name } = await initPlayerSession();
        const player: Player = {
          id,
          username: name,
          is_host: false,
          hand_cards: [],
          card_count: 0,
        };
        setLocalPlayer(player);
        setUsernameInput(name);
        console.log(
          "App: Initial player session initialized. Player ID:",
          id,
          "Username:",
          name
        );
      } catch (err: any) {
        console.error("App: Error initializing player session:", err);
        setError(err.message || "فشل في تهيئة جلسة اللاعب.");
      } finally {
        setLoading(false);
      }
    }
    initialize();

    roomSubscription.current = supabase
      .channel("room_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room" },
        (payload) => {
          const newRoom = payload.new as Room;
          const safeNewRoom: Room = {
            ...newRoom,
            players: newRoom.players || [],
            game_log: newRoom.game_log || [],
            last_played_cards: newRoom.last_played_cards || [],
          };

          console.log(
            "App: Realtime room update received. New room status:",
            safeNewRoom.status,
            "Room ID:",
            safeNewRoom.id
          );

          if (roomInfo && safeNewRoom.id === roomInfo.id) {
            setRoomInfo(safeNewRoom);
            console.log(
              "App: Updating current roomInfo with realtime data. Status:",
              safeNewRoom.status
            );
            if (
              safeNewRoom.status === "IN_PROGRESS" &&
              currentPage !== "game"
            ) {
              setCurrentPage("game");
              console.log(
                "App: Transitioning to game screen due to IN_PROGRESS status."
              );
            }
          } else if (
            !roomInfo &&
            safeNewRoom.players.some((p) => p.id === localPlayer?.id)
          ) {
            setRoomInfo(safeNewRoom);
            console.log(
              "App: Setting roomInfo for first time from realtime update. Status:",
              safeNewRoom.status
            );
            if (
              safeNewRoom.status === "IN_PROGRESS" &&
              currentPage !== "game"
            ) {
              setCurrentPage("game");
              console.log(
                "App: Transitioning to game screen due to IN_PROGRESS status (first time)."
              );
            } else if (
              safeNewRoom.status === "LOBBY" &&
              currentPage !== "game"
            ) {
              setCurrentPage("game");
              console.log(
                "App: Transitioning to game screen (LOBBY state, first time)."
              );
            }
          }
        }
      )
      .subscribe();

    playerSubscription.current = supabase
      .channel("player_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players" },
        (payload) => {
          const updatedPlayer = payload.new as Player;
          if (localPlayer && updatedPlayer.id === localPlayer.id) {
            console.log("App: Local player update received:", updatedPlayer);
            setLocalPlayer(updatedPlayer);
          }
        }
      )
      .subscribe();

    return () => {
      if (roomSubscription.current) {
        supabase.removeChannel(roomSubscription.current);
        console.log("App: Unsubscribed from room_changes.");
      }
      if (playerSubscription.current) {
        supabase.removeChannel(playerSubscription.current);
        console.log("App: Unsubscribed from player_changes.");
      }
    };
  }, [localPlayer?.id, roomInfo?.id, currentPage]);

  const handlePlayPress = useCallback(() => {
    setCurrentPage("lobby_selection");
    console.log("App: Navigating to LobbySelectionScreen.");
  }, []);

  const handleBackPress = useCallback(() => {
    setCurrentPage("welcome");
    console.log("App: Navigating back to WelcomeScreen.");
  }, []);

  const handleCreateRoom = useCallback(async () => {
    if (!localPlayer?.id) {
      Alert.alert("خطأ", "يجب أن يكون لديك معرف لاعب لإنشاء غرفة.");
      return;
    }
    setLoading(true);
    setError(null);
    console.log("App: Attempting to create room.");
    try {
      const room = await createRoom(localPlayer.id, localPlayer.username);
      const safeRoom: Room = {
        ...room,
        players: room.players || [],
        game_log: room.game_log || [],
        last_played_cards: room.last_played_cards || [],
      };
      setRoomInfo(safeRoom);
      console.log("App: Room created. SafeRoom object:", safeRoom); // Keep this log for verification

      // FIX: Update localPlayer to set is_host to true when creating a room
      setLocalPlayer((prevPlayer) => {
        if (prevPlayer) {
          return { ...prevPlayer, is_host: true };
        }
        return prevPlayer;
      });

      setCurrentPage("game");
      Alert.alert("نجاح", `تم إنشاء الغرفة بنجاح! الرمز: ${room.room_code}`);
      console.log(
        "App: Room created. Status:",
        safeRoom.status, // This will still log the status from the *previous* render cycle, but the state is correctly set for the next.
        "Cards in hand:",
        localPlayer.hand_cards.length // This also refers to the localPlayer state *before* the update in this current cycle.
      );
    } catch (err: any) {
      console.error("App: Error creating room:", err);
      setError(err.message || "فشل في إنشاء الغرفة.");
    } finally {
      setLoading(false);
    }
  }, [localPlayer]);

  const handleJoinRoom = useCallback(
    async (code: string) => {
      console.log("App: Attempting to join room with code:", code);
      console.log("App: Local Player ID:", localPlayer?.id);

      if (!code.trim()) {
        Alert.alert("خطأ", "الرجاء إدخال رمز الغرفة.");
        return;
      }
      if (!localPlayer?.id) {
        Alert.alert("خطأ", "يجب أن يكون لديك معرف لاعب للانضمام إلى غرفة.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const room = await joinRoom(
          code.trim(),
          localPlayer.id,
          localPlayer.username
        );
        const safeRoom: Room = {
          ...room,
          players: room.players || [],
          game_log: room.game_log || [],
          last_played_cards: room.last_played_cards || [],
        };
        setRoomInfo(safeRoom);
        setCurrentPage("game");
        Alert.alert("نجاح", `تم الانضمام إلى الغرفة ${room.room_code}`);
        console.log(
          "App: Successfully joined room. Status:",
          safeRoom.status,
          "Cards in hand:",
          localPlayer.hand_cards.length
        );
      } catch (err: any) {
        console.error("App: Error joining room:", err);
        setError(err.message || "فشل في الانضمام إلى الغرفة.");
        Alert.alert(
          "فشل الانضمام",
          err.message || "حدث خطأ أثناء الانضمام إلى الغرفة."
        );
      } finally {
        setLoading(false);
      }
    },
    [localPlayer]
  );

  const handleLeaveRoom = useCallback(async () => {
    if (!localPlayer?.id || !roomInfo?.id) {
      Alert.alert("خطأ", "أنت لست في غرفة لمغادرتها.");
      return;
    }
    setLoading(true);
    setError(null);
    console.log("App: Attempting to leave room.");
    try {
      await leaveRoom(roomInfo.id, localPlayer.id);
      setRoomInfo(null);
      setSelectedCards([]);
      Alert.alert("نجاح", "لقد غادرت الغرفة.");
      setCurrentPage("welcome");
      console.log("App: Successfully left room. Navigating to WelcomeScreen.");
    } catch (err: any) {
      console.error("App: Error leaving room:", err);
      setError(err.message || "فشل في مغادرة الغرفة.");
    } finally {
      setLoading(false);
    }
  }, [localPlayer, roomInfo]);

  const handleStartGame = useCallback(async () => {
    if (!roomInfo?.id) {
      Alert.alert("خطأ", "ليس هناك غرفة لبدء اللعبة فيها.");
      return;
    }
    if (roomInfo.players.length < 2) {
      Alert.alert("خطأ", "تحتاج إلى لاعبين اثنين على الأقل لبدء اللعبة.");
      return;
    }
    setLoading(true);
    setError(null);
    console.log("App: Attempting to start game.");
    try {
      await startGame(roomInfo.id, localPlayer?.id || "");
      Alert.alert("نجاح", "بدأت اللعبة!");
      console.log(
        "App: Game start initiated. Room status should update via realtime."
      );
    } catch (err: any) {
      console.error("App: Error starting game:", err);
      setError(err.message || "فشل في بدء اللعبة.");
    } finally {
      setLoading(false);
    }
  }, [roomInfo, localPlayer]);

  const handleCardPress = useCallback((card: Card) => {
    setSelectedCards((prev) =>
      prev.includes(card) ? prev.filter((c) => c !== card) : [...prev, card]
    );
    console.log("App: Card pressed:", card.rank, card.suit);
  }, []);

  const handlePlayCards = useCallback(async () => {
    if (
      !roomInfo?.id ||
      !localPlayer?.id ||
      selectedCards.length === 0 ||
      !declaredRankInput.trim()
    ) {
      Alert.alert("خطأ", "الرجاء اختيار بطاقات وتحديد الرتبة المعلنة.");
      return;
    }
    setLoading(true);
    setError(null);
    console.log("App: Attempting to play cards.");
    try {
      await playCards(
        roomInfo.id,
        localPlayer.id,
        selectedCards,
        declaredRankInput.trim()
      );
      setSelectedCards([]);
      setDeclaredRankInput("");
      console.log("App: Cards played successfully.");
    } catch (err: any) {
      console.error("App: Error playing cards:", err);
      setError(err.message || "فشل في لعب البطاقات.");
    } finally {
      setLoading(false);
    }
  }, [roomInfo, localPlayer, selectedCards, declaredRankInput]);

  const handleSkipTurn = useCallback(async () => {
    if (!roomInfo?.id || !localPlayer?.id) {
      Alert.alert("خطأ", "لا يمكنك تخطي الدور الآن.");
      return;
    }
    setLoading(true);
    setError(null);
    console.log("App: Attempting to skip turn.");
    try {
      await skipTurn(roomInfo.id, localPlayer.id);
      console.log("App: Turn skipped successfully.");
    } catch (err: any) {
      console.error("App: Error skipping turn:", err);
      setError(err.message || "فشل في تخطي الدور.");
    } finally {
      setLoading(false);
    }
  }, [roomInfo, localPlayer]);

  const handleCallLie = useCallback(async () => {
    if (!roomInfo?.id || !localPlayer?.id) {
      Alert.alert("خطأ", "لا يمكنك كشف الكذبة الآن.");
      return;
    }
    setLoading(true);
    setError(null);
    console.log("App: Attempting to call lie.");
    try {
      await callLie(roomInfo.id, localPlayer.id);
      console.log("App: Lie called successfully.");
    } catch (err: any) {
      console.error("App: Error calling lie:", err);
      setError(err.message || "فشل في كشف الكذبة.");
    } finally {
      setLoading(false);
    }
  }, [roomInfo, localPlayer]);

  const handleDiscardQuads = useCallback(
    async (rank: string) => {
      if (!roomInfo?.id || !localPlayer?.id) {
        Alert.alert("خطأ", "لا يمكنك التخلص من الرباعيات الآن.");
        return;
      }
      setLoading(true);
      setError(null);
      console.log("App: Attempting to discard quads of rank:", rank);
      try {
        await discardQuads(roomInfo.id, localPlayer.id, rank);
        Alert.alert("نجاح", `تخلصت من 4 بطاقات من رتبة ${rank}.`);
        console.log("App: Quads discarded successfully.");
      } catch (err: any) {
        console.error("App: Error discarding quads:", err);
        setError(err.message || "فشل في التخلص من الرباعيات.");
      } finally {
        setLoading(false);
      }
    },
    [roomInfo, localPlayer]
  );

  const dynamicPaddingTop = Dimensions.get("window").height * 0.05;

  const renderContent = () => {
    if (loading) {
      return (
        <View className="items-center justify-center flex-1 bg-gray-100">
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text className="mt-2 text-base text-gray-700">جاري التحميل...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="items-center justify-center flex-1 bg-gray-100">
          <Text className="mx-5 mb-5 text-base text-center text-red-500">
            خطأ: {error}
          </Text>
        </View>
      );
    }

    // This condition should now correctly evaluate to true when a room is created or joined
    // because roomInfo and localPlayer should be properly populated.
    if (roomInfo && localPlayer) {
      // Re-evaluate localPlayer.is_host here to ensure it's up-to-date
      // The isHost prop passed to GameScreen will now correctly use the updated localPlayer state.
      console.log(
        "App: Rendering GameScreen. Current room status:",
        roomInfo.status,
        "Local player hand cards:",
        localPlayer.hand_cards.length,
        "Local player is host (from App state):",
        localPlayer.is_host // Add this log to confirm the localPlayer's is_host property
      );
      return (
        <GameScreen
          roomInfo={roomInfo}
          localPlayer={localPlayer} // This localPlayer now has is_host: true for creator
          selectedCards={selectedCards}
          declaredRankInput={declaredRankInput}
          setDeclaredRankInput={setDeclaredRankInput}
          showFullLogModal={showFullLogModal}
          setShowFullLogModal={setShowFullLogModal}
          handleCardPress={handleCardPress}
          handlePlayCards={handlePlayCards}
          handleSkipTurn={handleSkipTurn}
          handleCallLie={handleCallLie}
          handleDiscardQuads={handleDiscardQuads}
          handleLeaveRoom={handleLeaveRoom}
          handleStartGame={handleStartGame}
          loading={loading}
        />
      );
    }

    if (currentPage === "welcome") {
      console.log("App: Rendering WelcomeScreen.");
      return (
        <WelcomeScreen
          localPlayer={localPlayer}
          setLocalPlayer={setLocalPlayer}
          usernameInput={usernameInput}
          setUsernameInput={setUsernameInput}
          setLoading={setLoading}
          setError={setError}
          onPlayPress={handlePlayPress}
          loading={loading}
        />
      );
    } else if (currentPage === "lobby_selection") {
      console.log("App: Rendering LobbySelectionScreen.");
      return (
        <LobbySelectionScreen
          roomCodeInput={roomCodeInput}
          setRoomCodeInput={setRoomCodeInput}
          handleCreateRoom={handleCreateRoom}
          handleJoinRoom={handleJoinRoom}
          loading={loading}
          handleBackPress={handleBackPress}
        />
      );
    }
    console.log("App: Unknown content state. Current page:", currentPage);
    return (
      <View className="items-center justify-center flex-1 bg-gray-100">
        <Text className="mx-5 mb-5 text-base text-center text-red-500">
          حالة غير معروفة.
        </Text>
      </View>
    );
  };

  return <View className="flex-1 bg-gray-100">{renderContent()}</View>;
}
