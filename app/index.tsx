import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage"; // Import AsyncStorage
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
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [roomInfo, setRoomInfo] = useState<Room | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [currentPage, setCurrentPage] = useState<CurrentPage>("welcome");
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [declaredRankInput, setDeclaredRankInput] = useState<string>("");
  const [showFullLogModal, setShowFullLogModal] = useState(false);
  const roomSubscription = useRef<any>(null);
  const playerSubscription = useRef<any>(null);
  const initializedPlayerSession = useRef(false);

  const saveRoomInfo = async (roomCode: string) => {
    try {
      await AsyncStorage.setItem("lastRoomCode", roomCode);
    } catch (e) {
      console.error("Failed to save room info to local storage", e);
    }
  };

  const loadRoomInfo = async () => {
    try {
      const lastRoomCode = await AsyncStorage.getItem("lastRoomCode");
      return { lastRoomCode };
    } catch (e) {
      console.error("Failed to load room info from local storage", e);
      return { lastRoomId: null, lastRoomCode: null, lastPlayerId: null };
    }
  };

  const removeRoomInfo = async () => {
    try {
      await AsyncStorage.removeItem("lastRoomCode");
    } catch (e) {
      console.error("Failed to remove room info from local storage", e);
    }
  };

  useEffect(() => {
    async function initialize() {
      if (initializedPlayerSession.current) {
        return;
      }
      initializedPlayerSession.current = true;
      setLoading(true);
      try {
        const { id, name } = await initPlayerSession();
        const player: Player = {
          id,
          name,
        };
        setLocalPlayer(player);
        setNameInput(name);
        const { lastRoomCode } = await loadRoomInfo();
        if (lastRoomCode) {
          try {
            const { data: room, error: fetchError } = await supabase
              .from("room")
              .select("*")
              .eq("room_code", lastRoomCode)
              .single();
            if (fetchError) {
              if (fetchError.code === "PGRST116") {
                throw new Error(`Room with code '${lastRoomCode}' not found.`);
              }
              throw new Error(`Failed to fetch room: ${fetchError.message}`);
            }
            setRoomInfo(room);
            setCurrentPage("game");
            Alert.alert(
              "تم إعادة الاتصال",
              `تمت إعادة الاتصال بالغرفة ${lastRoomCode}`
            );
          } catch (err: any) {
            Alert.alert(
              "فشل إعادة الاتصال",
              "فشل في إعادة الانضمام إلى الغرفة السابقة."
            );
            removeRoomInfo();
          }
        }
      } catch (err: any) {
        Alert.alert("خطأ", "فشل في تهيئة جلسة اللاعب.");
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
          const room = payload.new as Room;
          if (roomInfo && room.id === roomInfo.id) {
            setRoomInfo(room);
            if (room.status === "IN_PROGRESS" && currentPage !== "game") {
              setCurrentPage("game");
            }
          } else if (
            !roomInfo &&
            room.players.some((p) => p.id === localPlayer?.id)
          ) {
            setRoomInfo(room);
            if (room.status === "IN_PROGRESS" && currentPage !== "game") {
              setCurrentPage("game");
            } else if (room.status === "LOBBY" && currentPage !== "game") {
              setCurrentPage("game");
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
            setLocalPlayer(updatedPlayer);
          }
        }
      )
      .subscribe();

    return () => {
      if (roomSubscription.current) {
        supabase.removeChannel(roomSubscription.current);
      }
      if (playerSubscription.current) {
        supabase.removeChannel(playerSubscription.current);
      }
    };
  }, [localPlayer?.id, roomInfo?.id, currentPage]);

  const handlePlayPress = useCallback(() => {
    setCurrentPage("lobby_selection");
  }, []);

  const handleBackPress = useCallback(() => {
    setCurrentPage("welcome");
  }, []);

  const handleCreateRoom = useCallback(async () => {
    if (!localPlayer?.id) {
      Alert.alert("خطأ", "يجب أن يكون لديك معرف لاعب لإنشاء غرفة.");
      return;
    }
    setLoading(true);
    try {
      const { room } = await createRoom(localPlayer.id, localPlayer.username);
      setRoomInfo(room);
      setCurrentPage("game");
      saveRoomInfo(room.room_code); // Save roomCode
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في إنشاء الغرفة.");
    } finally {
      setLoading(false);
    }
  }, [localPlayer]);

  const handleJoinRoom = useCallback(
    async (code: string) => {
      if (!code.trim()) {
        Alert.alert("خطأ", "الرجاء إدخال رمز الغرفة.");
        return;
      }
      if (!localPlayer?.id) {
        Alert.alert("خطأ", "يجب أن يكون لديك معرف لاعب للانضمام إلى غرفة.");
        return;
      }
      setLoading(true);
      try {
        const { room } = await joinRoom(
          code.trim(),
          localPlayer.id,
          localPlayer.username
        );
        setRoomInfo(room);
        setCurrentPage("game");
        saveRoomInfo(room.room_code);
      } catch (err: any) {
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
    try {
      await leaveRoom(roomInfo.id, localPlayer.id);
      setRoomInfo(null);
      setSelectedCards([]);
      setCurrentPage("welcome");
      removeRoomInfo();
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في مغادرة الغرفة.");
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
    try {
      await startGame(roomInfo.id, localPlayer?.id as string);
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في بدء اللعبة.");
    } finally {
      setLoading(false);
    }
  }, [roomInfo, localPlayer]);

  const handleCardPress = useCallback((card: Card) => {
    setSelectedCards((prev) => {
      if (prev.includes(card)) {
        return prev.filter((c) => c !== card);
      } else {
        if (prev.length < 4) {
          return [...prev, card];
        } else {
          Alert.alert("خطأ", "يمكنك اختيار 4 بطاقات فقط في كل مرة.");
          return prev;
        }
      }
    });
  }, []);

  const handlePlayCards = useCallback(async () => {
    if (
      !roomInfo?.id ||
      !localPlayer?.id ||
      selectedCards.length === 0 ||
      (declaredRankInput.trim() === "" && roomInfo.declared_rank === null)
    ) {
      Alert.alert("خطأ", "الرجاء اختيار بطاقات وتحديد الرتبة المعلنة.");
      return;
    }
    setLoading(true);
    try {
      let normalizedRank = declaredRankInput.trim().toUpperCase();
      const rankMap: { [key: string]: string } = {
        J: "JACK",
        جاك: "JACK",
        و: "JACK",
        Q: "QUEEN",
        ملكة: "QUEEN",
        ق: "QUEEN",
        K: "KING",
        ملك: "KING",
        ك: "KING",
        A: "ACE",
        آص: "ACE",
        أ: "ACE",
      };
      if (rankMap[normalizedRank]) {
        normalizedRank = rankMap[normalizedRank];
      } else if (
        normalizedRank.length === 1 &&
        "2345678910".includes(normalizedRank)
      ) {
      } else if (
        normalizedRank.length > 1 &&
        !isNaN(parseInt(normalizedRank))
      ) {
      } else if (
        normalizedRank.length === 1 &&
        "JQKA".includes(normalizedRank)
      ) {
      } else if (normalizedRank.length > 1) {
        normalizedRank = normalizedRank;
      }
      if (roomInfo.declared_rank === null && !normalizedRank) {
        Alert.alert("خطأ", "يجب تحديد الرتبة المعلنة.");
        return;
      }
      const finalDeclaredRank =
        normalizedRank || (roomInfo.declared_rank as string);
      await playCards(
        roomInfo.id,
        localPlayer.id,
        selectedCards,
        finalDeclaredRank
      );
      setSelectedCards([]);
      setDeclaredRankInput("");
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في لعب البطاقات.");
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
    try {
      await skipTurn(roomInfo.id, localPlayer.id);
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في تخطي الدور.");
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
    try {
      await callLie(roomInfo.id, localPlayer.id);
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في كشف الكذبة.");
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
      try {
        await discardQuads(roomInfo.id, localPlayer.id, rank);
        setSelectedCards([]);
        Alert.alert("نجاح", `تخلصت من 4 بطاقات من رتبة ${rank}.`);
      } catch (err: any) {
        Alert.alert("خطأ", err.message || "فشل في التخلص من الرباعيات.");
      } finally {
        setLoading(false);
      }
    },
    [roomInfo, localPlayer]
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View className="items-center justify-center flex-1 bg-gray-100">
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text className="mt-2 text-base text-gray-700">جاري التحميل...</Text>
        </View>
      );
    }
    if (roomInfo && localPlayer) {
      return (
        <GameScreen
          roomInfo={roomInfo}
          localPlayer={localPlayer}
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
      return (
        <WelcomeScreen
          localPlayer={localPlayer}
          setLocalPlayer={setLocalPlayer}
          usernameInput={nameInput}
          setUsernameInput={setNameInput}
          setLoading={setLoading}
          onPlayPress={handlePlayPress}
          loading={loading}
        />
      );
    } else if (currentPage === "lobby_selection") {
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
