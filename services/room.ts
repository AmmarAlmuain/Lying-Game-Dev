import supabase from "./supabase"; // تأكد من صحة هذا المسار

// لا حاجة لـ declare function uuidv4(): string; هنا، حيث أن Supabase عادةً ما يتعامل معها
// أو يمكنك استخدام crypto.randomUUID() في المتصفح/React Native إذا كنت بحاجة لإنشاء UUIDs يدوياً.

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
const suits = ["HEARTS", "DIAMONDS", "CLUBS", "SPADES"];

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

interface Room {
  last_played_cards: never[];
  id: string;
  room_code: string;
  players: Player[];
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED";
  host_player_id: string; // إضافة host_player_id
  turn_order_player_ids: string[]; // إضافة turn_order_player_ids
  current_player_index: number;
  pile_cards_count: number;
  pile_cards: Card[];
  last_played_by_player_id: string | null;
  last_played_cards_actual: Card[] | null;
  declared_rank: string | null;
  last_player_to_play_id: string | null;
  consecutive_skips_count: number;
  game_log: string[];
  winner_player_id: string | null;
  created_at: string; // تأكد من وجود هذا الحقل في قاعدة البيانات
}

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper to get the next player's index
function getNextPlayerIndex(
  currentIndex: number,
  totalPlayers: number
): number {
  return (currentIndex + 1) % totalPlayers;
}

export async function createRoom(
  playerId: string,
  username: string
): Promise<{ room: Room; player: Player }> {
  // تم تعديل نوع الإرجاع
  if (!playerId) {
    throw new Error("Player ID is required to create a room.");
  }
  if (!username) {
    throw new Error("Username is required to create a room.");
  }

  const newRoomCode = Math.floor(1000 + Math.random() * 9000).toString();

  const initialPlayers: Player[] = [
    {
      id: playerId,
      username: username,
      is_host: true,
      hand_cards: [],
      card_count: 0,
    },
  ];

  const { data: newRoom, error: roomError } = await supabase
    .from("room")
    .insert({
      room_code: newRoomCode,
      status: "LOBBY",
      host_player_id: playerId,
      turn_order_player_ids: [playerId],
      current_player_index: 0,
      pile_cards_count: 0,
      pile_cards: [],
      last_played_by_player_id: null,
      last_played_cards_actual: null,
      declared_rank: null,
      players: initialPlayers,
      last_player_to_play_id: null,
      consecutive_skips_count: 0,
      game_log: [`${username} أنشأ الغرفة.`], // إضافة رسالة إنشاء الغرفة
      winner_player_id: null,
    })
    .select()
    .single();

  if (roomError) {
    console.error("Error creating room:", roomError);
    throw new Error(`Failed to create room: ${roomError.message}`);
  }

  // يجب أن نجد اللاعب المضيف من البيانات المرجعة للتأكد من أنه هو نفسه
  const hostPlayerRecord = newRoom.players.find(
    (p: Player) => p.id === playerId
  );
  if (!hostPlayerRecord) {
    throw new Error("Host player record not found in the created room.");
  }

  return { room: newRoom as Room, player: hostPlayerRecord as Player };
}

export async function joinRoom(
  roomCode: string,
  playerId: string,
  username: string
): Promise<{ room: Room; player: Player }> {
  // تم تعديل نوع الإرجاع
  if (!roomCode) {
    throw new Error("Room Code is required to join a room.");
  }
  if (!playerId) {
    throw new Error("Player ID is required to join a room.");
  }
  if (!username) {
    throw new Error("Username is required to join a room.");
  }

  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select(
      "id, room_code, status, players, turn_order_player_ids, game_log, host_player_id"
    ) // إضافة host_player_id
    .eq("room_code", roomCode)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Room with code '${roomCode}' not found.`);
    }
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== "LOBBY") {
    throw new Error(`Cannot join room. Room status is '${room.status}'.`);
  }

  const MAX_PLAYERS = 4;
  if (room.players.length >= MAX_PLAYERS) {
    throw new Error("Room is full. Cannot join.");
  }

  const isPlayerAlreadyInRoom = room.players.some(
    (p: Player) => p.id === playerId
  );
  if (isPlayerAlreadyInRoom) {
    const existingPlayerRecord = room.players.find(
      (p: Player) => p.id === playerId
    );
    return { room: room as Room, player: existingPlayerRecord as Player };
  }

  const newPlayer: Player = {
    id: playerId,
    username: username,
    is_host: false,
    hand_cards: [],
    card_count: 0,
  };

  const updatedPlayers = [...room.players, newPlayer];
  const updatedTurnOrderPlayerIds = [...room.turn_order_player_ids, playerId];

  // Add join message to game log
  const updatedGameLog = [...room.game_log, `${username} انضم إلى الغرفة.`];

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      players: updatedPlayers,
      turn_order_player_ids: updatedTurnOrderPlayerIds,
      game_log: updatedGameLog,
    })
    .eq("id", room.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to join room: ${updateError.message}`);
  }

  return { room: updatedRoom as Room, player: newPlayer as Player };
}

export async function startGame(
  roomId: string,
  hostPlayerId: string
): Promise<Room> {
  // تم تعديل نوع الإرجاع
  if (!roomId) {
    throw new Error("Room ID is required to start the game.");
  }
  if (!hostPlayerId) {
    throw new Error("Host Player ID is required to start the game.");
  }

  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.host_player_id !== hostPlayerId) {
    throw new Error("Only the host can start the game.");
  }
  if (room.status !== "LOBBY") {
    throw new Error(`Cannot start game. Room status is '${room.status}'.`);
  }

  const numPlayers = room.players.length;
  if (numPlayers < 2 || numPlayers > 4) {
    throw new Error(
      `Lying Game requires 2 to 4 players to start. Current players: ${numPlayers}.`
    );
  }

  const fullDeck = shuffleArray(createDeck());
  const cardsPerPlayer = 13; // Each player gets 13 cards

  // Check if there are enough cards in the deck for all players
  if (numPlayers * cardsPerPlayer > fullDeck.length) {
    throw new Error(
      "Not enough cards in the deck to deal 13 cards to each player."
    );
  }

  const shuffledPlayerIds = shuffleArray(room.players.map((p: Player) => p.id)); // استخدام Player

  const updatedPlayers = room.players.map((player: Player, index: number) => {
    // استخدام Player
    const startIndex = index * cardsPerPlayer;
    const endIndex = startIndex + cardsPerPlayer;
    const playerHand = fullDeck.slice(startIndex, endIndex);
    return {
      ...player,
      hand_cards: playerHand,
      card_count: playerHand.length,
    };
  });

  // Add game start message to game log
  const hostPlayer = room.players.find((p: Player) => p.id === hostPlayerId); // استخدام Player
  const updatedGameLog = [`${hostPlayer?.username || "المضيف"} بدأ اللعبة.`]; // إعادة تعيين السجل عند بدء اللعبة

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      status: "IN_PROGRESS",
      turn_order_player_ids: shuffledPlayerIds,
      current_player_index: 0,
      pile_cards_count: 0,
      pile_cards: [],
      last_played_by_player_id: null,
      last_played_cards_actual: null,
      declared_rank: null, // إعادة تعيين الرتبة المعلنة عند بدء اللعبة
      players: updatedPlayers,
      last_player_to_play_id: null, // إعادة تعيين عند بدء اللعبة
      consecutive_skips_count: 0, // إعادة تعيين عند بدء اللعبة
      game_log: updatedGameLog, // تحديث سجل اللعبة
      winner_player_id: null, // إعادة تعيين الفائز عند بدء اللعبة
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("Error starting game:", updateError);
    throw new Error(`Failed to start game: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function playCards(
  roomId: string,
  playerId: string,
  cardsToPlay: Card[], // استخدام Card
  declaredRank: string
): Promise<Room> {
  // تم تعديل نوع الإرجاع
  if (!roomId || !playerId || !cardsToPlay || !declaredRank) {
    throw new Error("Missing required parameters for playing cards.");
  }
  // --- NEW VALIDATION: Limit cards to play between 1 and 4 ---
  if (cardsToPlay.length === 0 || cardsToPlay.length > 4) {
    throw new Error("You must play between 1 and 4 cards.");
  }
  if (!ranks.includes(declaredRank)) {
    throw new Error("Invalid declared rank.");
  }

  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot play cards. Game is not in progress (status: ${room.status}).`
    );
  }

  // Check if it's the current player's turn
  const currentPlayerIdInTurnOrder =
    room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to play cards.");
  }

  let updatedPlayers = room.players.map((p: Player) => {
    // استخدام Player
    if (p.id === playerId) {
      // Create a copy of hand_cards to modify
      let currentHand = [...p.hand_cards];
      const playedCardsActual: Card[] = []; // استخدام Card

      for (const cardToPlay of cardsToPlay) {
        const cardIndex = currentHand.findIndex(
          (card) =>
            card.rank === cardToPlay.rank && card.suit === cardToPlay.suit
        );
        if (cardIndex > -1) {
          currentHand.splice(cardIndex, 1); // Remove one instance of the card
          playedCardsActual.push(cardToPlay);
        } else {
          throw new Error(
            `Player does not have card: ${cardToPlay.rank}-${cardToPlay.suit}`
          );
        }
      }

      return {
        ...p,
        hand_cards: currentHand,
        card_count: currentHand.length,
      };
    }
    return p;
  });

  const playerWhoPlayed = updatedPlayers.find((p: Player) => p.id === playerId); // استخدام Player
  let newRoomStatus = room.status;
  let newWinnerPlayerId = room.winner_player_id;

  // Check for win condition (player has 0 cards)
  if (playerWhoPlayed && playerWhoPlayed.card_count === 0) {
    newRoomStatus = "COMPLETED";
    newWinnerPlayerId = playerId;
  }

  const updatedPileCards = [...room.pile_cards, ...cardsToPlay];
  const nextPlayerIndex = getNextPlayerIndex(
    room.current_player_index,
    room.turn_order_player_ids.length
  );

  // Add play message to game log
  const playerName =
    room.players.find((p: Player) => p.id === playerId)?.username || // استخدام Player
    "لاعب غير معروف";
  let updatedGameLog = room.game_log;

  // إذا كانت الكومة فارغة قبل هذه اللعبة، فهذه "جولة" جديدة، لذلك قم بمسح السجل
  if (room.pile_cards_count === 0) {
    updatedGameLog = []; // مسح السجل لجولة جديدة
  }
  updatedGameLog.push(
    `${playerName} لعب ${cardsToPlay.length} بطاقة (بطاقات) معلناً أنها ${declaredRank}.`
  );

  // Add win message if game ended
  if (newRoomStatus === "COMPLETED") {
    updatedGameLog.push(`${playerName} فاز باللعبة!`);
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      players: updatedPlayers,
      pile_cards: updatedPileCards,
      pile_cards_count: updatedPileCards.length,
      last_played_by_player_id: playerId,
      last_played_cards_actual: cardsToPlay, // Store the actual cards played
      declared_rank: declaredRank, // Store the declared rank
      current_player_index: nextPlayerIndex, // Advance turn
      last_player_to_play_id: playerId, // Update last player to play
      consecutive_skips_count: 0, // Reset skips after a play
      game_log: updatedGameLog, // Update game log
      status: newRoomStatus, // Update game status
      winner_player_id: newWinnerPlayerId, // Set winner
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("Error playing cards:", updateError);
    throw new Error(`Failed to play cards: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function skipTurn(
  roomId: string,
  playerId: string
): Promise<Room> {
  // تم تعديل نوع الإرجاع
  if (!roomId || !playerId) {
    throw new Error("Missing required parameters for skipping turn.");
  }

  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot skip turn. Game is not in progress (status: ${room.status}).`
    );
  }

  // Check if it's the current player's turn
  const currentPlayerIdInTurnOrder =
    room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to skip.");
  }

  // A player can only skip if there are cards in the pile.
  // If the pile is empty, the current player MUST play.
  if (room.pile_cards_count === 0) {
    throw new Error(
      "Cannot skip turn when the pile is empty. You must play a card."
    );
  }

  const numPlayers = room.players.length;
  let nextPlayerIndex = getNextPlayerIndex(
    room.current_player_index,
    numPlayers
  );
  let updatedConsecutiveSkips = room.consecutive_skips_count + 1;
  let newDeclaredRank = room.declared_rank; // Keep current declared rank by default

  // Add skip message to game log
  const playerName =
    room.players.find((p: Player) => p.id === playerId)?.username || // استخدام Player
    "لاعب غير معروف";
  const updatedGameLog = [...room.game_log, `${playerName} تخطى دوره.`];

  // Logic for when all other players have skipped and turn returns to last player to play
  if (
    updatedConsecutiveSkips === numPlayers - 1 &&
    room.last_player_to_play_id
  ) {
    // All players except the one who last played have skipped.
    // Turn returns to the last player who played, and they must declare a new rank.
    nextPlayerIndex = room.turn_order_player_ids.indexOf(
      room.last_player_to_play_id
    );
    updatedConsecutiveSkips = 0; // Reset skips
    newDeclaredRank = null; // Reset declared rank, forcing new declaration
    updatedGameLog.push(
      `عاد الدور إلى ${
        room.players.find((p: Player) => p.id === room.last_player_to_play_id) // استخدام Player
          ?.username || "اللاعب السابق"
      }. يجب عليه اللعب وإعلان رتبة جديدة.`
    );
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      current_player_index: nextPlayerIndex, // Advance turn
      consecutive_skips_count: updatedConsecutiveSkips, // Update skip count
      declared_rank: newDeclaredRank, // Potentially reset declared rank
      game_log: updatedGameLog, // Update game log
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("Error skipping turn:", updateError);
    throw new Error(`Failed to skip turn: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function callLie(
  roomId: string,
  callingPlayerId: string
): Promise<Room> {
  // تم تعديل نوع الإرجاع
  if (!roomId || !callingPlayerId) {
    throw new Error("Missing required parameters for calling a lie.");
  }

  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot call lie. Game is not in progress (status: ${room.status}).`
    );
  }

  if (
    !room.last_played_by_player_id ||
    room.pile_cards_count === 0 ||
    !room.last_played_cards_actual ||
    !room.declared_rank
  ) {
    throw new Error("No cards have been played to call a lie on.");
  }

  // The player calling the lie cannot be the one who just played
  if (room.last_played_by_player_id === callingPlayerId) {
    throw new Error("You cannot call a lie on yourself.");
  }

  // Determine if the lie was successful
  const actualRankOfPlayedCards = room.last_played_cards_actual.every(
    (card: Card) => card.rank === room.declared_rank // استخدام Card
  );
  const playerWhoPlayedId = room.last_played_by_player_id;
  const pileCards = room.pile_cards; // Get all cards from the pile

  let updatedPlayers = room.players;
  let nextPlayerIndex: number;
  let lieCallMessage: string;
  let newRoomStatus = room.status;
  let newWinnerPlayerId = room.winner_player_id;

  const callingPlayerName =
    room.players.find((p: Player) => p.id === callingPlayerId)?.username || // استخدام Player
    "لاعب غير معروف";
  const playedPlayerName =
    room.players.find((p: Player) => p.id === playerWhoPlayedId)?.username || // استخدام Player
    "لاعب غير معروف";

  if (!actualRankOfPlayedCards) {
    // The player who played *lied* (caller was correct)
    updatedPlayers = updatedPlayers.map((p: Player) => {
      // استخدام Player
      if (p.id === playerWhoPlayedId) {
        // Lying player takes the pile
        const newHand = [...p.hand_cards, ...pileCards];
        return {
          ...p,
          hand_cards: newHand,
          card_count: newHand.length,
        };
      }
      return p;
    });
    // The calling player (who was correct) gets the next turn
    nextPlayerIndex = room.turn_order_player_ids.indexOf(callingPlayerId);
    lieCallMessage = `${callingPlayerName} اتهم ${playedPlayerName} بالكذب! ${playedPlayerName} كان يكذب وأخذ جميع البطاقات. الدور الآن لـ ${callingPlayerName}.`;
  } else {
    // The player who played *told the truth* (caller was wrong)
    updatedPlayers = updatedPlayers.map((p: Player) => {
      // استخدام Player
      if (p.id === callingPlayerId) {
        // Caller takes the pile
        const newHand = [...p.hand_cards, ...pileCards];
        return {
          ...p,
          hand_cards: newHand,
          card_count: newHand.length,
        };
      }
      return p;
    });
    // The player who played (who told the truth) gets the next turn
    nextPlayerIndex = room.turn_order_player_ids.indexOf(playerWhoPlayedId);
    lieCallMessage = `${callingPlayerName} اتهم ${playedPlayerName} بالكذب! ${playedPlayerName} كان يقول الحقيقة. ${callingPlayerName} أخذ جميع البطاقات. الدور الآن لـ ${playedPlayerName}.`;
  }

  // Check for win condition after taking cards (unlikely, but possible if pile was small)
  updatedPlayers.forEach((p: Player) => {
    // استخدام Player
    if (p.card_count === 0) {
      newRoomStatus = "COMPLETED";
      newWinnerPlayerId = p.id;
      lieCallMessage += ` ${p.username} فاز باللعبة!`; // Append win message
    }
  });

  const updatedGameLog = [lieCallMessage]; // Reset log after a lie call and add the new message

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      players: updatedPlayers,
      pile_cards: [], // Reset pile
      pile_cards_count: 0, // Reset pile count
      last_played_by_player_id: null, // Clear last played info
      last_played_cards_actual: null,
      declared_rank: null, // Clear declared rank, forcing new declaration
      current_player_index: nextPlayerIndex, // Set next player based on lie outcome
      consecutive_skips_count: 0, // Reset skips after a lie call
      game_log: updatedGameLog, // Update game log
      status: newRoomStatus, // Update game status
      winner_player_id: newWinnerPlayerId, // Set winner
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("Error calling lie:", updateError);
    throw new Error(`Failed to call lie: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function discardQuads(
  roomId: string,
  playerId: string,
  rankToDiscard: string
): Promise<Room> {
  // تم تعديل نوع الإرجاع
  if (!roomId || !playerId || !rankToDiscard) {
    throw new Error("Missing required parameters for discarding cards.");
  }
  if (!ranks.includes(rankToDiscard)) {
    throw new Error("Invalid rank to discard.");
  }

  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select("*")
    .eq("id", roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot discard cards. Game is not in progress (status: ${room.status}).`
    );
  }

  // Check if it's the current player's turn
  const currentPlayerIdInTurnOrder =
    room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to discard cards.");
  }

  let updatedPlayers = room.players.map((p: Player) => {
    // استخدام Player
    if (p.id === playerId) {
      let currentHand = [...p.hand_cards];
      const cardsToRemove: Card[] = [];
      const suitsFound: Set<string> = new Set();

      // Find all cards of the specified rank
      const cardsOfRank = currentHand.filter(
        (card) => card.rank === rankToDiscard
      );

      // Check if there are exactly 4 cards of that rank, one for each suit
      if (cardsOfRank.length === 4) {
        let hasAllSuits = true;
        for (const card of cardsOfRank) {
          if (suitsFound.has(card.suit)) {
            hasAllSuits = false; // Found duplicate suit for the same rank, not a true quad
            break;
          }
          suitsFound.add(card.suit);
        }

        if (hasAllSuits && suitsFound.size === 4) {
          // Remove these 4 cards from the hand
          currentHand = currentHand.filter(
            (card) => card.rank !== rankToDiscard
          );
          cardsToRemove.push(...cardsOfRank); // Store for logging
        } else {
          throw new Error(
            `Player does not have a complete set of four ${rankToDiscard}s (one of each suit).`
          );
        }
      } else {
        throw new Error(
          `Player does not have exactly four cards of rank ${rankToDiscard}. Found: ${cardsOfRank.length}`
        );
      }

      return {
        ...p,
        hand_cards: currentHand,
        card_count: currentHand.length,
      };
    }
    return p;
  });

  const playerWhoDiscarded = updatedPlayers.find(
    (p: Player) => p.id === playerId
  ); // استخدام Player
  let newRoomStatus = room.status;
  let newWinnerPlayerId = room.winner_player_id;

  // Check for win condition after discarding (if hand becomes empty)
  if (playerWhoDiscarded && playerWhoDiscarded.card_count === 0) {
    newRoomStatus = "COMPLETED";
    newWinnerPlayerId = playerId;
  }

  // Add discard message to game log
  const playerName =
    room.players.find((p: Player) => p.id === playerId)?.username || // استخدام Player
    "لاعب غير معروف";
  const discardMessage = `${playerName} تخلص من أربع بطاقات من رتبة ${rankToDiscard}.`;
  let updatedGameLog = [...room.game_log, discardMessage];

  // Add win message if game ended
  if (newRoomStatus === "COMPLETED") {
    updatedGameLog.push(`${playerName} فاز باللعبة!`);
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      players: updatedPlayers,
      // Pile cards, last played info, declared rank, current player index remain unchanged
      // as discarding does not advance the turn or affect the pile.
      game_log: updatedGameLog, // Update game log
      status: newRoomStatus, // Update game status
      winner_player_id: newWinnerPlayerId, // Set winner
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    console.error("Error discarding quads:", updateError);
    throw new Error(`Failed to discard cards: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

// الدالة المحدثة لمغادرة الغرفة
export async function leaveRoom(
  roomId: string,
  playerId: string
): Promise<void> {
  // جلب حالة الغرفة الحالية
  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select("players, host_player_id, turn_order_player_ids, game_log") // جلب host_player_id و turn_order_player_ids
    .eq("id", roomId)
    .single();

  if (fetchError || !room) {
    console.error("Error fetching room to leave:", fetchError);
    throw new Error("الغرفة غير موجودة أو حدث خطأ أثناء المغادرة.");
  }

  const leavingPlayer = room.players.find((p: Player) => p.id === playerId);
  if (!leavingPlayer) {
    throw new Error("اللاعب غير موجود في هذه الغرفة.");
  }

  // تحديث قائمة اللاعبين بإزالة اللاعب الذي غادر
  let updatedPlayers = room.players.filter((p: Player) => p.id !== playerId);
  let updatedHostPlayerId = room.host_player_id;
  let updatedTurnOrderPlayerIds = room.turn_order_player_ids.filter(
    (id: string) => id !== playerId
  );
  let updatedGameLog = [
    ...room.game_log,
    `${leavingPlayer.username} غادر الغرفة.`,
  ]; // إضافة رسالة مغادرة

  // إذا كان اللاعب المغادر هو المضيف وهناك لاعبون آخرون، قم بتعيين مضيف جديد
  if (leavingPlayer.is_host && updatedPlayers.length > 0) {
    updatedPlayers[0] = { ...updatedPlayers[0], is_host: true }; // تعيين أول لاعب متبقٍ كمضيف جديد
    updatedHostPlayerId = updatedPlayers[0].id; // تحديث host_player_id في الغرفة
    updatedGameLog.push(`تم تعيين ${updatedPlayers[0].username} كمضيف جديد.`);
  }

  if (updatedPlayers.length === 0) {
    // إذا لم يتبق أي لاعبين، احذف الغرفة
    const { error: deleteError } = await supabase
      .from("room")
      .delete()
      .eq("id", roomId);

    if (deleteError) {
      console.error("Error deleting empty room:", deleteError);
      throw new Error(deleteError.message);
    }
  } else {
    // وإلا، قم بتحديث الغرفة باللاعبين المتبقين والمضيف الجديد وترتيب الأدوار وسجل اللعبة
    const { error: updateError } = await supabase
      .from("room")
      .update({
        players: updatedPlayers,
        host_player_id: updatedHostPlayerId,
        turn_order_player_ids: updatedTurnOrderPlayerIds,
        game_log: updatedGameLog,
      })
      .eq("id", roomId);

    if (updateError) {
      console.error("Error updating room after player left:", updateError);
      throw new Error(updateError.message);
    }
  }
}
