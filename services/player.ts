import supabase from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";

const randomNames = [
  "ملك الأوراق",
  "سيد الظلام",
  "فارس النور",
  "صائد التنانين",
  "حارس الأسرار",
  "أميرة النجوم",
  "بطل الصحراء",
  "روح الغابة",
  "أسطورة الزمن",
  "ظل القمر",
  "قلب الأسد",
  "عين الصقر",
  "نصل القدر",
  "درع الشجاعة",
  "همس الريح",
  "صوت الرعد",
  "نجمة الفجر",
  "قائد الأشباح",
  "كنز البحار",
  "حكيم الجبال",
  "وردة الصحراء",
  "فجر الأمل",
  "شمس العز",
  "قمر الليل",
  "نار الانتقام",
  "جليد الشمال",
  "رمح العدالة",
  "سهم الحقيقة",
  "أرض الأحلام",
  "سماء الأبطال",
  "بوابة النسيان",
  "كهف الأسرار",
  "بحر النجوم",
  "قلعة الصمود",
  "واحة السلام",
  "جبل الشموخ",
];

export async function initPlayerSession(): Promise<{
  id: string;
  name: string;
}> {
  let playerId = await AsyncStorage.getItem("player_id");
  let playerName = await AsyncStorage.getItem("player_name");

  if (!playerId) {
    playerId = uuidv4();
    await AsyncStorage.setItem("player_id", playerId);
  }

  if (!playerName) {
    const randomIndex = Math.floor(Math.random() * randomNames.length);
    playerName = randomNames[randomIndex];
    await AsyncStorage.setItem("player_name", playerName);
  }

  return { id: playerId, name: playerName };
}

export async function changePlayerName(newName: string): Promise<void> {
  if (!newName) {
    throw new Error("اسم المستخدم لا يمكن أن يكون فارغاً.");
  }
  await AsyncStorage.setItem("player_name", newName);
}
