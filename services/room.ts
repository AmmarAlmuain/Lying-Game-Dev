import supabase from './supabase';
declare function uuidv4(): string;

const ranks = ['ACE', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING'];
const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

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
function getNextPlayerIndex(currentIndex: number, totalPlayers: number): number {
  return (currentIndex + 1) % totalPlayers;
}

export async function createRoom(playerId: string, username: string): Promise<{ room: any; player: any }> {
  if (!playerId) {
    throw new Error("Player ID is required to create a room.");
  }
  if (!username) {
    throw new Error("Username is required to create a room.");
  }

  const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const initialPlayers = [
    {
      id: playerId,
      username: username,
      is_host: true,
      hand_cards: [],
      card_count: 0,
    }
  ];

  const { data: newRoom, error: roomError } = await supabase
    .from('room')
    .insert({
      room_code: newRoomCode,
      status: 'LOBBY',
      host_player_id: playerId,
      turn_order_player_ids: [playerId],
      current_player_index: 0,
      pile_cards_count: 0,
      pile_cards: [],
      last_played_by_player_id: null,
      last_played_cards_actual: null,
      declared_rank: null, // Track the declared rank for lie calls
      players: initialPlayers,
      last_player_to_play_id: null, // New: Track who last played cards
      consecutive_skips_count: 0, // New: Track consecutive skips
      game_log: [], // New: For game notifications
    })
    .select()
    .single();

  if (roomError) {
    throw new Error(`Failed to create room: ${roomError.message}`);
  }

  const hostPlayerRecord = newRoom.players.find((p: any) => p.id === playerId);

  return { room: newRoom, player: hostPlayerRecord };
}

export async function joinRoom(roomCode: string, playerId: string, username: string): Promise<{ room: any; player: any }> {
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
    .from('room')
    .select('id, room_code, status, players, turn_order_player_ids, game_log') // Select game_log
    .eq('room_code', roomCode)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      throw new Error(`Room with code '${roomCode}' not found.`);
    }
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== 'LOBBY') {
    throw new Error(`Cannot join room. Room status is '${room.status}'.`);
  }

  const MAX_PLAYERS = 4;
  if (room.players.length >= MAX_PLAYERS) {
    throw new Error("Room is full. Cannot join.");
  }

  const isPlayerAlreadyInRoom = room.players.some((p: any) => p.id === playerId);
  if (isPlayerAlreadyInRoom) {
    const existingPlayerRecord = room.players.find((p: any) => p.id === playerId);
    return { room: room, player: existingPlayerRecord };
  }

  const newPlayer = {
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
    .from('room')
    .update({
      players: updatedPlayers,
      turn_order_player_ids: updatedTurnOrderPlayerIds,
      game_log: updatedGameLog, // Update game log
    })
    .eq('id', room.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to join room: ${updateError.message}`);
  }

  return { room: updatedRoom, player: newPlayer };
}

export async function startGame(roomId: string, hostPlayerId: string): Promise<any> {
  if (!roomId) {
    throw new Error("Room ID is required to start the game.");
  }
  if (!hostPlayerId) {
    throw new Error("Host Player ID is required to start the game.");
  }

  const { data: room, error: fetchError } = await supabase
    .from('room')
    .select('*')
    .eq('id', roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.host_player_id !== hostPlayerId) {
    throw new Error("Only the host can start the game.");
  }
  if (room.status !== 'LOBBY') {
    throw new Error(`Cannot start game. Room status is '${room.status}'.`);
  }

  const numPlayers = room.players.length;
  if (numPlayers < 2 || numPlayers > 4) {
    throw new Error(`Lying Game requires 2 to 4 players to start. Current players: ${numPlayers}.`);
  }

  const fullDeck = shuffleArray(createDeck());
  const cardsPerPlayer = Math.floor(fullDeck.length / numPlayers);

  const shuffledPlayerIds = shuffleArray(room.players.map((p: any) => p.id));

  const updatedPlayers = room.players.map((player: any, index: number) => {
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
  const hostPlayer = room.players.find((p: any) => p.id === hostPlayerId);
  const updatedGameLog = [...room.game_log, `${hostPlayer?.username || 'المضيف'} بدأ اللعبة.`];


  const { data: updatedRoom, error: updateError } = await supabase
    .from('room')
    .update({
      status: 'IN_PROGRESS',
      turn_order_player_ids: shuffledPlayerIds,
      current_player_index: 0,
      pile_cards_count: 0,
      pile_cards: [],
      last_played_by_player_id: null,
      last_played_cards_actual: null,
      declared_rank: null, // Reset declared rank at game start
      players: updatedPlayers,
      last_player_to_play_id: null, // Reset on game start
      consecutive_skips_count: 0, // Reset on game start
      game_log: updatedGameLog, // Update game log
    })
    .eq('id', roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to start game: ${updateError.message}`);
  }

  return updatedRoom;
}

export async function playCards(
  roomId: string,
  playerId: string,
  cardsToPlay: { rank: string; suit: string }[],
  declaredRank: string
): Promise<any> {
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
    .from('room')
    .select('*')
    .eq('id', roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot play cards. Game is not in progress (status: ${room.status}).`);
  }

  // Check if it's the current player's turn
  const currentPlayerIdInTurnOrder = room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to play cards.");
  }

  let updatedPlayers = room.players.map((p: any) => {
    if (p.id === playerId) {
      // Create a copy of hand_cards to modify
      let currentHand = [...p.hand_cards];
      const playedCardsActual = [];

      for (const cardToPlay of cardsToPlay) {
        const cardIndex = currentHand.findIndex(card => card.rank === cardToPlay.rank && card.suit === cardToPlay.suit);
        if (cardIndex > -1) {
          currentHand.splice(cardIndex, 1); // Remove one instance of the card
          playedCardsActual.push(cardToPlay);
        } else {
          throw new Error(`Player does not have card: ${cardToPlay.rank}-${cardToPlay.suit}`);
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

  // Check for win condition (player has 0 cards)
  const playerWhoPlayed = updatedPlayers.find((p: any) => p.id === playerId);
  if (playerWhoPlayed && playerWhoPlayed.card_count === 0) {
    // TODO: Implement game end logic here, e.g., set room status to 'COMPLETED'
    console.log(`${playerWhoPlayed.username} has no cards left!`);
    // For now, the game continues, but this player is out of cards.
    // You'd typically remove them from turn_order_player_ids or mark them as finished.
  }

  const updatedPileCards = [...room.pile_cards, ...cardsToPlay];
  const nextPlayerIndex = getNextPlayerIndex(room.current_player_index, room.turn_order_player_ids.length);

  // Add play message to game log
  const playerName = room.players.find((p: any) => p.id === playerId)?.username || 'لاعب غير معروف';
  const playMessage = `${playerName} لعب ${cardsToPlay.length} بطاقة (بطاقات) معلناً أنها ${declaredRank}.`;
  const updatedGameLog = [...room.game_log, playMessage];

  const { data: updatedRoom, error: updateError } = await supabase
    .from('room')
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
    })
    .eq('id', roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to play cards: ${updateError.message}`);
  }

  return updatedRoom;
}

export async function skipTurn(roomId: string, playerId: string): Promise<any> {
  if (!roomId || !playerId) {
    throw new Error("Missing required parameters for skipping turn.");
  }

  const { data: room, error: fetchError } = await supabase
    .from('room')
    .select('*')
    .eq('id', roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot skip turn. Game is not in progress (status: ${room.status}).`);
  }

  // Check if it's the current player's turn
  const currentPlayerIdInTurnOrder = room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to skip.");
  }

  // A player can only skip if there are cards in the pile.
  // If the pile is empty, the current player MUST play.
  if (room.pile_cards_count === 0) {
    throw new Error("Cannot skip turn when the pile is empty. You must play a card.");
  }

  const numPlayers = room.players.length;
  let nextPlayerIndex = getNextPlayerIndex(room.current_player_index, numPlayers);
  let updatedConsecutiveSkips = room.consecutive_skips_count + 1;
  let newDeclaredRank = room.declared_rank; // Keep current declared rank by default

  // Add skip message to game log
  const playerName = room.players.find((p: any) => p.id === playerId)?.username || 'لاعب غير معروف';
  const skipMessage = `${playerName} تخطى دوره.`;
  const updatedGameLog = [...room.game_log, skipMessage];

  // Logic for when all other players have skipped and turn returns to last player to play
  if (updatedConsecutiveSkips === numPlayers - 1 && room.last_player_to_play_id) {
    // All players except the one who last played have skipped.
    // Turn returns to the last player who played, and they must declare a new rank.
    nextPlayerIndex = room.turn_order_player_ids.indexOf(room.last_player_to_play_id);
    updatedConsecutiveSkips = 0; // Reset skips
    newDeclaredRank = null; // Reset declared rank, forcing new declaration
    updatedGameLog.push(`عاد الدور إلى ${room.players.find(p => p.id === room.last_player_to_play_id)?.username || 'اللاعب السابق'}. يجب عليه اللعب وإعلان رتبة جديدة.`);
  }


  const { data: updatedRoom, error: updateError } = await supabase
    .from('room')
    .update({
      current_player_index: nextPlayerIndex, // Advance turn
      consecutive_skips_count: updatedConsecutiveSkips, // Update skip count
      declared_rank: newDeclaredRank, // Potentially reset declared rank
      game_log: updatedGameLog, // Update game log
    })
    .eq('id', roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to skip turn: ${updateError.message}`);
  }

  return updatedRoom;
}


export async function callLie(roomId: string, callingPlayerId: string): Promise<any> {
  if (!roomId || !callingPlayerId) {
    throw new Error("Missing required parameters for calling a lie.");
  }

  const { data: room, error: fetchError } = await supabase
    .from('room')
    .select('*')
    .eq('id', roomId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
  }

  if (room.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot call lie. Game is not in progress (status: ${room.status}).`);
  }

  if (!room.last_played_by_player_id || room.pile_cards_count === 0 || !room.last_played_cards_actual || !room.declared_rank) {
    throw new Error("No cards have been played to call a lie on.");
  }

  // The player calling the lie cannot be the one who just played
  if (room.last_played_by_player_id === callingPlayerId) {
    throw new Error("You cannot call a lie on yourself.");
  }

  // Determine if the lie was successful
  const actualRankOfPlayedCards = room.last_played_cards_actual.every((card: any) => card.rank === room.declared_rank);
  const playerWhoPlayedId = room.last_played_by_player_id;
  const pileCards = room.pile_cards; // Get all cards from the pile

  let updatedPlayers = room.players;
  let nextPlayerIndex: number;
  let lieCallMessage: string;

  const callingPlayerName = room.players.find((p: any) => p.id === callingPlayerId)?.username || 'لاعب غير معروف';
  const playedPlayerName = room.players.find((p: any) => p.id === playerWhoPlayedId)?.username || 'لاعب غير معروف';

  if (!actualRankOfPlayedCards) { // The player who played *lied* (caller was correct)
    updatedPlayers = updatedPlayers.map((p: any) => {
      if (p.id === playerWhoPlayedId) { // Lying player takes the pile
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

  } else { // The player who played *told the truth* (caller was wrong)
    updatedPlayers = updatedPlayers.map((p: any) => {
      if (p.id === callingPlayerId) { // Caller takes the pile
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
  updatedPlayers.forEach((p: any) => {
    if (p.card_count === 0) {
      // TODO: Implement game end logic here, e.g., set room status to 'COMPLETED'
      console.log(`${p.username} has no cards left after taking pile!`);
    }
  });

  const updatedGameLog = [...room.game_log, lieCallMessage];

  const { data: updatedRoom, error: updateError } = await supabase
    .from('room')
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
    })
    .eq('id', roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to call lie: ${updateError.message}`);
  }

  return updatedRoom;
}
