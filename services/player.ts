// services/player.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-get-random-values"; // IMPORTANT: This import must be at the very top of your project's entry file (e.g., App.tsx or index.js)
import { v4 as uuidv4 } from "uuid";

const ID_KEY = "player_id";
const NAME_KEY = "player_name";

function generateRandomUsername(): string {
  const adjectives = [
    "Swift",
    "Brave",
    "Clever",
    "Silent",
    "Mighty",
    "Wise",
    "Quick",
    "Bold",
  ];
  const nouns = [
    "Fox",
    "Wolf",
    "Eagle",
    "Lion",
    "Bear",
    "Tiger",
    "Hawk",
    "Panther",
  ];
  const randomAdjective =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${randomAdjective}${randomNoun}${Math.floor(Math.random() * 100)}`;
}

export async function initPlayerSession(): Promise<{
  id: string;
  name: string | null;
}> {
  let playerId = await AsyncStorage.getItem(ID_KEY);
  if (!playerId) {
    playerId = uuidv4();
    await AsyncStorage.setItem(ID_KEY, playerId);
  }

  let playerName = await AsyncStorage.getItem(NAME_KEY);
  if (!playerName) {
    playerName = generateRandomUsername();
    await AsyncStorage.setItem(NAME_KEY, playerName);
  }

  return { id: playerId, name: playerName };
}

export async function changePlayerUsername(name: string): Promise<void> {
  await AsyncStorage.setItem(NAME_KEY, name);
}
