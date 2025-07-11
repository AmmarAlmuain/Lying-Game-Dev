// App.tsx or index.ts

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Button,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
  FlatList,
} from "react-native";

// Ensure these imports are correct based on your file structure
import { initPlayerSession, changePlayerUsername } from "../services/player";
import {
  createRoom,
  joinRoom,
  startGame,
  playCards,
  skipTurn,
} from "../services/room";
import supabase from "../services/supabase"; // Import the Supabase client directly

// IMPORTANT: These imports are crucial for Expo/React Native environment
// They should be at the very top of your project's entry file (e.g., App.tsx or index.js)
// import 'react-native-url-polyfill/auto';
// import 'react-native-get-random-values';
// import { v4 as uuidv4 } from 'uuid'; // Only if you need to generate UUIDs directly in App.tsx for testing

// Card type definition for clarity
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

export default function App() {
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null); // Stores the full local player object
  const [roomInfo, setRoomInfo] = useState<any>(null); // Stores the current room state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [declaredRankInput, setDeclaredRankInput] = useState<string>("");

  // --- Initial Setup: Player Session and Room Re-joining ---
  useEffect(() => {
    const setupInitialState = async () => {
      try {
        setLoading(true);
        setError(null);

        const initialPlayerSession = await initPlayerSession();
        // IMMEDIATELY set localPlayer with at least the ID and a default structure
        // This ensures localPlayer.id is available as soon as initPlayerSession resolves
        setLocalPlayer({
          id: initialPlayerSession.id,
          username: initialPlayerSession.name || "", // Use the name from session or empty string
          is_host: false, // Default
          hand_cards: [], // Default
          card_count: 0, // Default
        });
        setUsernameInput(initialPlayerSession.name || "");
        console.log("Player Initialized (Initial Set):", initialPlayerSession);

        // Now, proceed with room fetching and update localPlayer if found in a room
        const { data: rooms, error: roomFetchError } = await supabase
          .from("room")
          .select("*")
          .contains("players", [{ id: initialPlayerSession.id }]);

        if (roomFetchError) {
          console.warn(
            "Error checking for existing room:",
            roomFetchError.message
          );
          // If there's a fetch error, localPlayer already holds the basic info.
        } else if (rooms && rooms.length > 0) {
          const existingRoom = rooms[0];
          setRoomInfo(existingRoom);
          setRoomCodeInput(existingRoom.room_code);
          const playerInRoom = existingRoom.players.find(
            (p: Player) => p.id === initialPlayerSession.id
          );
          if (playerInRoom) {
            setLocalPlayer(playerInRoom); // Update with full player data from room
          }
          console.log("Rejoined existing room:", existingRoom);
        }
        // If no room found, localPlayer remains as initially set.
      } catch (err: any) {
        console.error("Error during initial setup:", err);
        setError(err.message || "An unknown error occurred during setup.");
        // If an error occurs here, localPlayer might not be fully set,
        // but the `loading` state will prevent immediate action.
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
          setRoomInfo(payload.new); // Update the room state with the latest data

          // Also update the local player's specific data from the new room state
          const updatedLocalPlayer = payload.new.players.find(
            (p: Player) => p.id === localPlayer?.id
          );
          if (updatedLocalPlayer) {
            setLocalPlayer(updatedLocalPlayer);
          }
          setSelectedCards([]); // Clear selected cards on any room update
          setDeclaredRankInput(""); // Clear declared rank input
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
          Alert.alert(
            "Room Deleted",
            "The host has left or the room has been deleted."
          );
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [roomInfo?.id, localPlayer?.id]); // Depend on roomInfo.id and localPlayer.id for re-subscription

  // --- Handlers for UI Actions ---

  const handleChangeUsername = async () => {
    if (!usernameInput) {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      await changePlayerUsername(usernameInput);
      // Update localPlayer's username directly for immediate feedback
      setLocalPlayer((prev) =>
        prev ? { ...prev, username: usernameInput } : null
      );
      Alert.alert("Success", "Username updated!");
    } catch (err: any) {
      console.error("Error changing username:", err);
      setError(err.message || "Failed to change username.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!usernameInput) {
      Alert.alert("Error", "Please enter a username.");
      return;
    }
    if (!localPlayer?.id) {
      // This check should ideally pass now due to immediate localPlayer setting
      Alert.alert("Error", "Player ID not available. Please restart the app.");
      return;
    }

    setLoading(true);
    try {
      const { room: newRoom, player: hostPlayerRecord } = await createRoom(
        localPlayer.id,
        usernameInput
      );
      setRoomInfo(newRoom);
      setLocalPlayer(hostPlayerRecord); // Set local player as the host from the room record
      setRoomCodeInput(newRoom.room_code);
      console.log("Room Created:", newRoom);
    } catch (err: any) {
      console.error("Error creating room:", err);
      setError(err.message || "Failed to create room.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!usernameInput || !roomCodeInput) {
      Alert.alert("Error", "Please enter a username and room code.");
      return;
    }
    if (!localPlayer?.id) {
      // This check should ideally pass now due to immediate localPlayer setting
      Alert.alert("Error", "Player ID not available. Please restart the app.");
      return;
    }

    setLoading(true);
    try {
      const { room: joinedRoom, player: joinedPlayerRecord } = await joinRoom(
        roomCodeInput,
        localPlayer.id,
        usernameInput
      );
      setRoomInfo(joinedRoom);
      setLocalPlayer(joinedPlayerRecord); // Set local player as the joined player from the room record
      console.log("Joined Room:", joinedRoom);
    } catch (err: any) {
      console.error("Error joining room:", err);
      setError(err.message || "Failed to join room.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomInfo || !localPlayer) {
      setError("Room or player information is not available.");
      return;
    }
    if (roomInfo.host_player_id !== localPlayer.id) {
      Alert.alert("Error", "Only the host can start the game.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // startGame updates the room, which will trigger the realtime listener
      await startGame(roomInfo.id, localPlayer.id);
      console.log("Game Start request sent.");
    } catch (err: any) {
      console.error("Error starting game:", err);
      setError(err.message || "Failed to start game.");
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
          "Room Deleted",
          "You left and the room was deleted as you were the host."
        );
      } else {
        const { data: currentRoom, error: fetchRoomError } = await supabase
          .from("room")
          .select("players")
          .eq("id", roomInfo.id)
          .single();

        if (fetchRoomError) throw fetchRoomError;

        const updatedPlayers = currentRoom.players.filter(
          (p: any) => p.id !== localPlayer.id
        );

        const { error: roomUpdateError } = await supabase
          .from("room")
          .update({ players: updatedPlayers })
          .eq("id", roomInfo.id);

        if (roomUpdateError) throw roomUpdateError;

        Alert.alert("Left Room", "You left the room.");

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
      setError(err.message || "Error leaving room.");
    } finally {
      setLoading(false);
    }
  };

  // Modified handleCardPress to limit selection to 4 cards
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
        // Only allow adding if less than 4 cards are already selected
        if (prevSelected.length < 4) {
          return [...prevSelected, card];
        } else {
          Alert.alert("Limit Reached", "You can select a maximum of 4 cards.");
          return prevSelected; // Return current selection if limit reached
        }
      }
    });
  }, []);

  const handlePlayCards = async () => {
    if (!localPlayer || !roomInfo) {
      Alert.alert("Error", "Player or room information missing.");
      return;
    }
    if (selectedCards.length === 0) {
      Alert.alert("Error", "Please select at least one card to play.");
      return;
    }
    // The 4-card limit is now enforced by handleCardPress, but this check remains as a safeguard
    if (selectedCards.length > 4) {
      Alert.alert("Error", "You can play a maximum of 4 cards.");
      return;
    }
    if (
      !declaredRankInput ||
      !ranks.includes(declaredRankInput.toUpperCase())
    ) {
      Alert.alert("Error", `Please declare a valid rank: ${ranks.join(", ")}`);
      return;
    }
    setLoading(true);
    try {
      await playCards(
        roomInfo.id,
        localPlayer.id,
        selectedCards,
        declaredRankInput.toUpperCase()
      );
      setSelectedCards([]); // Clear selection after playing
      setDeclaredRankInput(""); // Clear declared rank after playing
      Alert.alert("Success", "Cards played!");
    } catch (err: any) {
      console.error("Error playing cards:", err);
      setError(err.message || "Failed to play cards.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipTurn = async () => {
    if (!localPlayer || !roomInfo) return;
    setLoading(true);
    try {
      await skipTurn(roomInfo.id, localPlayer.id);
      Alert.alert("Turn Skipped", "You passed your turn.");
    } catch (err: any) {
      console.error("Error skipping turn:", err);
      setError(err.message || "Failed to skip turn.");
    } finally {
      setLoading(false);
    }
  };

  const handleCallLie = async () => {
    if (!localPlayer || !roomInfo) return;
    setLoading(true);
    try {
      await callLie(roomInfo.id, localPlayer.id);
      Alert.alert("Lie Called!", "The lie has been called.");
    } catch (err: any) {
      console.error("Error calling lie:", err);
      setError(err.message || "Failed to call lie.");
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

  const currentDisplayRoom = roomInfo; // Always use roomInfo as it's updated by realtime

  // Determine if "Call Lie" button should be visible/enabled
  const canCallLie =
    roomInfo &&
    localPlayer &&
    roomInfo.status === "IN_PROGRESS" &&
    roomInfo.last_played_by_player_id &&
    roomInfo.last_played_by_player_id !== localPlayer.id &&
    roomInfo.pile_cards_count > 0 && // Must have cards in pile to call lie
    roomInfo.turn_order_player_ids[roomInfo.current_player_index] ===
      localPlayer.id; // Only current player can call lie

  // Determine if "Skip Turn" button should be visible/enabled
  // Based on our discussion:
  // - First player (or when pile is empty) MUST play, cannot skip.
  // - Other players can skip if there are cards in the pile.
  const canSkipTurn = isMyTurn && roomInfo && roomInfo.pile_cards_count > 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => window.location.reload()}
        >
          <Text style={styles.buttonText}>Reload App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Text style={styles.title}>Lying Game</Text>

        {/* Player ID for Debugging */}
        {localPlayer?.id && (
          <Text style={styles.debugText}>Your Player ID: {localPlayer.id}</Text>
        )}

        {/* Username Input and Change Button */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Profile</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Username"
            value={usernameInput}
            onChangeText={setUsernameInput}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={handleChangeUsername}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Change Username</Text>
          </TouchableOpacity>
        </View>

        {/* Lobby/Room Creation/Join UI */}
        {!currentDisplayRoom?.id ? ( // Show lobby if not in a room
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Room Lobby</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={handleCreateRoom}
              disabled={loading || !localPlayer?.id}
            >
              <Text style={styles.buttonText}>Create New Room</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TextInput
              style={styles.input}
              placeholder="Enter Room Code to Join"
              value={roomCodeInput}
              onChangeText={setRoomCodeInput}
              autoCapitalize="characters"
              editable={!loading && !!localPlayer?.id} // Disable input while loading or if player ID not ready
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleJoinRoom}
              disabled={loading || !localPlayer?.id}
            >
              <Text style={styles.buttonText}>Join Room</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Show room info if in a room
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Room Details</Text>
            <Text style={styles.roomCodeText}>
              Room Code: {currentDisplayRoom.room_code}
            </Text>
            <Text style={styles.playerInfo}>
              Your Username: {localPlayer?.username}
            </Text>
            <Text style={styles.playerInfo}>
              You are {localPlayer?.is_host ? "the Host" : "a Player"}
            </Text>
            <Text style={styles.playerInfo}>
              Room Status: {currentDisplayRoom.status}
            </Text>

            {currentDisplayRoom.status === "IN_PROGRESS" && (
              <Text style={styles.turnInfo}>
                Current Turn:{" "}
                {
                  currentDisplayRoom.players?.find(
                    (p: Player) =>
                      p.id ===
                      currentDisplayRoom.turn_order_player_ids[
                        currentDisplayRoom.current_player_index
                      ]
                  )?.username
                }
                {isMyTurn && " (YOUR TURN!)"}
              </Text>
            )}

            <Text style={styles.sectionSubTitle}>
              Players in Room ({currentDisplayRoom.players?.length || 0}):
            </Text>
            {currentDisplayRoom.players &&
              currentDisplayRoom.players.map((p: Player) => (
                <Text key={p.id} style={styles.playerListItem}>
                  - {p.username} {p.id === localPlayer?.id ? "(You)" : ""}{" "}
                  {p.is_host ? "(Host)" : ""}{" "}
                  {currentDisplayRoom.status === "IN_PROGRESS" &&
                    `(${p.card_count} cards)`}
                </Text>
              ))}

            {currentDisplayRoom.status === "LOBBY" && localPlayer?.is_host && (
              <TouchableOpacity
                style={[styles.button, styles.startButton]}
                onPress={handleStartGame}
                disabled={
                  currentDisplayRoom.players?.length < 2 ||
                  currentDisplayRoom.players?.length > 4 ||
                  loading
                }
              >
                <Text style={styles.buttonText}>
                  Start Game ({currentDisplayRoom.players?.length}/4)
                </Text>
              </TouchableOpacity>
            )}

            {currentDisplayRoom.status === "IN_PROGRESS" && (
              <View style={styles.gameInProgressInfo}>
                <Text style={styles.sectionSubTitle}>Game State:</Text>
                <Text>Pile Cards: {currentDisplayRoom.pile_cards_count}</Text>
                {currentDisplayRoom.declared_rank && (
                  <Text>
                    Last Declared: {currentDisplayRoom.declared_rank} by{" "}
                    {
                      currentDisplayRoom.players?.find(
                        (p: Player) =>
                          p.id === currentDisplayRoom.last_played_by_player_id
                      )?.username
                    }
                  </Text>
                )}

                {/* Player's Hand */}
                <Text style={styles.sectionSubTitle}>
                  Your Hand ({localPlayer?.card_count || 0} cards):
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
                        <Text style={styles.cardText}>{item.rank}</Text>
                        <Text style={styles.cardSuit}>
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
                  <Text style={styles.noCardsText}>No cards in hand.</Text>
                )}

                {/* Play Cards UI */}
                {isMyTurn && (
                  <View style={styles.playControls}>
                    <Text style={styles.sectionSubTitle}>Play Cards:</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Declare Rank (e.g., ACE, KING)"
                      value={declaredRankInput}
                      onChangeText={setDeclaredRankInput}
                      autoCapitalize="characters"
                      editable={!loading} // Disable input while loading
                    />
                    <TouchableOpacity
                      style={[
                        styles.button,
                        selectedCards.length === 0 || !declaredRankInput
                          ? styles.disabledButton
                          : {},
                      ]}
                      onPress={handlePlayCards}
                      disabled={
                        selectedCards.length === 0 ||
                        !declaredRankInput ||
                        loading
                      }
                    >
                      <Text style={styles.buttonText}>
                        Play {selectedCards.length} Card(s)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Call Lie / Skip Turn Buttons */}
                {canCallLie && (
                  <TouchableOpacity
                    style={[styles.button, styles.callLieButton]}
                    onPress={handleCallLie}
                    disabled={loading}
                  >
                    <Text style={styles.buttonText}>Call Lie!</Text>
                  </TouchableOpacity>
                )}
                {isMyTurn && canSkipTurn && (
                  <TouchableOpacity
                    style={[styles.button, styles.skipTurnButton]}
                    onPress={handleSkipTurn}
                    disabled={loading}
                  >
                    <Text style={styles.buttonText}>Skip Turn</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.leaveButton]}
              onPress={handleLeaveRoom}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Leave Room</Text>
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
    backgroundColor: "#f0f4f7",
    paddingTop: 50,
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: "#555",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 30,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  message: {
    fontSize: 16,
    color: "#007bff",
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
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  sectionSubTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#555",
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    backgroundColor: "#007bff",
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#007bff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#a0c8ff", // Lighter blue for disabled
  },
  divider: {
    width: "80%",
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 20,
  },
  roomCodeText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#444",
    marginBottom: 10,
    textAlign: "center",
  },
  playerInfo: {
    fontSize: 16,
    color: "#333",
    marginBottom: 5,
    textAlign: "center",
  },
  playerListItem: {
    fontSize: 14,
    color: "#555",
    textAlign: "left",
    width: "100%",
    paddingLeft: 10,
    paddingVertical: 2,
  },
  startButton: {
    backgroundColor: "#28a745",
    marginTop: 20,
    shadowColor: "#28a745",
  },
  leaveButton: {
    backgroundColor: "#dc3545",
    marginTop: 20,
    shadowColor: "#dc3545",
  },
  gameInProgressInfo: {
    marginTop: 20,
    width: "100%",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  turnInfo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#007bff",
    marginBottom: 15,
    textAlign: "center",
  },
  handContainer: {
    flexDirection: "row",
    flexWrap: "wrap", // Allow cards to wrap to the next line
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 5,
  },
  card: {
    width: 60,
    height: 90,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    margin: 5,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  selectedCard: {
    borderColor: "#007bff",
    borderWidth: 3,
    backgroundColor: "#e6f2ff", // Lighter background for selected
  },
  cardText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  cardSuit: {
    fontSize: 18,
    color: "#555",
  },
  noCardsText: {
    fontSize: 16,
    color: "#777",
    textAlign: "center",
    marginTop: 10,
  },
  playControls: {
    width: "100%",
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 15,
  },
  callLieButton: {
    backgroundColor: "#ffc107", // Yellow for call lie
    shadowColor: "#ffc107",
    marginTop: 15,
  },
  skipTurnButton: {
    backgroundColor: "#6c757d", // Grey for skip turn
    shadowColor: "#6c757d",
    marginTop: 10,
  },
});
