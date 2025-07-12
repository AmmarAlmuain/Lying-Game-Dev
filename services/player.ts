// services/player.ts

import supabase from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage"; // Import AsyncStorage
import { v4 as uuidv4 } from "uuid"; // Import uuidv4 for UUID generation

// List of common Arabic names for random generation
const arabicNames = [
  "أحمد",
  "محمد",
  "علي",
  "فاطمة",
  "زينب",
  "مريم",
  "خالد",
  "سارة",
  "ليلى",
  "يوسف",
  "نور",
  "عمر",
  "ريم",
  "حسن",
  "جميلة",
  "طارق",
  "سميرة",
  "فارس",
  "هند",
  "كريم",
  "ماجد",
  "ياسين",
  "آية",
  "بدر",
  "دنيا",
  "ريان",
  "سلمى",
  "شادي",
  "عائشة",
  "غادة",
  "فهد",
  "قاسم",
  "لؤي",
  "مها",
  "ناصر",
  "هالة",
  "وليد",
  "يمنى",
  "زهرة",
  "عادل",
];

export async function initPlayerSession(): Promise<{
  id: string;
  name: string | null;
}> {
  let playerId = await AsyncStorage.getItem("player_id");
  let playerName = await AsyncStorage.getItem("player_name");

  if (!playerId) {
    // Generate a new player ID if not found
    playerId = uuidv4(); // Use uuidv4 for React Native compatible UUID
    await AsyncStorage.setItem("player_id", playerId);
  }

  if (!playerName) {
    // Generate a random Arabic name if not found
    const randomIndex = Math.floor(Math.random() * arabicNames.length);
    playerName = arabicNames[randomIndex];
    await AsyncStorage.setItem("player_name", playerName);
  }

  // Optionally, you can also store this player in a 'players' table in Supabase
  // if you need a persistent record beyond local storage.
  // For this app's current scope, local storage is sufficient for session tracking.

  return { id: playerId, name: playerName };
}

export async function changePlayerUsername(newUsername: string): Promise<void> {
  if (!newUsername) {
    throw new Error("اسم المستخدم لا يمكن أن يكون فارغاً."); // Username cannot be empty.
  }
  await AsyncStorage.setItem("player_name", newUsername);

  // If you had a 'players' table, you would update it here:
  // const playerId = await AsyncStorage.getItem('player_id');
  // if (playerId) {
  //   const { error } = await supabase
  //     .from('players')
  //     .update({ username: newUsername })
  //     .eq('id', playerId);
  //   if (error) {
  //     console.error('Error updating player username in DB:', error.message);
  //     throw new Error('فشل في تحديث اسم المستخدم في قاعدة البيانات.'); // Failed to update username in database.
  //   }
  // }
}
