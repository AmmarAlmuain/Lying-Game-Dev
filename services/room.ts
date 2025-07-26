import supabase from "./supabase";

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

function getNextPlayerIndex(
  currentIndex: number,
  totalPlayers: number
): number {
  return (currentIndex + 1) % totalPlayers;
}

export async function createRoom(
  playerId: string,
  name: string
): Promise<{ room: Room; player: Player }> {
  if (!playerId) {
    throw new Error("Player ID is required to create a room.");
  }
  if (!name) {
    throw new Error("Name is required to create a room.");
  }

  const newRoomCode = Math.floor(1000 + Math.random() * 9000).toString();

  const initialPlayers: Player[] = [
    {
      id: playerId,
      name: name,
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
      game_log: [`${name} أنشأ الغرفة.`],
      winner_player_id: null,
    })
    .select()
    .single();

  if (roomError) {
    throw new Error(`Failed to create room: ${roomError.message}`);
  }

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
  name: string
): Promise<{ room: Room; player: Player }> {
  if (!roomCode) {
    throw new Error("Room Code is required to join a room.");
  }
  if (!playerId) {
    throw new Error("Player ID is required to join a room.");
  }
  if (!name) {
    throw new Error("Name is required to join a room.");
  }

  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select(
      "id, room_code, status, players, turn_order_player_ids, game_log, host_player_id"
    )
    .eq("room_code", roomCode)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error(`Room with code '${roomCode}' not found.`);
    }
    throw new Error(`Failed to fetch room: ${fetchError.message}`);
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

  if (room.status !== "LOBBY") {
    throw new Error(`Cannot join room. Room status is '${room.status}'.`);
  }

  const MAX_PLAYERS = 4;
  if (room.players.length >= MAX_PLAYERS) {
    throw new Error("Room is full. Cannot join.");
  }

  const newPlayer: Player = {
    id: playerId,
    name,
    is_host: false,
    hand_cards: [],
    card_count: 0,
  };

  const updatedPlayers = [...room.players, newPlayer];
  const updatedTurnOrderPlayerIds = [...room.turn_order_player_ids, playerId];

  const updatedGameLog = [...room.game_log, `${name} انضم إلى الغرفة.`];

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
  const cardsPerPlayer = 13;

  if (numPlayers * cardsPerPlayer > fullDeck.length) {
    throw new Error(
      "Not enough cards in the deck to deal 13 cards to each player."
    );
  }

  const shuffledPlayerIds = shuffleArray(room.players.map((p: Player) => p.id));

  const updatedPlayers = room.players.map((player: Player, index: number) => {
    const startIndex = index * cardsPerPlayer;
    const endIndex = startIndex + cardsPerPlayer;
    const playerHand = fullDeck.slice(startIndex, endIndex);
    return {
      ...player,
      hand_cards: playerHand,
      card_count: playerHand.length,
    };
  });

  const hostPlayer = room.players.find((p: Player) => p.id === hostPlayerId);
  const updatedGameLog = [`${hostPlayer?.name || "المضيف"} بدأ اللعبة.`];

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
      declared_rank: null,
      players: updatedPlayers,
      last_player_to_play_id: null,
      consecutive_skips_count: 0,
      game_log: updatedGameLog,
      winner_player_id: null,
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to start game: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function playCards(
  roomId: string,
  playerId: string,
  cardsToPlay: Card[],
  declaredRank: string
): Promise<Room> {
  if (!roomId || !playerId || !cardsToPlay || !declaredRank) {
    throw new Error("Missing required parameters for playing cards.");
  }
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

  const currentPlayerIdInTurnOrder =
    room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to play cards.");
  }

  let updatedPlayers = room.players.map((p: Player) => {
    if (p.id === playerId) {
      let currentHand = [...p.hand_cards];
      const playedCardsActual: Card[] = [];

      for (const cardToPlay of cardsToPlay) {
        const cardIndex = currentHand.findIndex(
          (card) =>
            card.rank === cardToPlay.rank && card.suit === cardToPlay.suit
        );
        if (cardIndex > -1) {
          currentHand.splice(cardIndex, 1);
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

  const playerWhoPlayed = updatedPlayers.find((p: Player) => p.id === playerId);
  let newRoomStatus = room.status;
  let newWinnerPlayerId = room.winner_player_id;

  if (playerWhoPlayed && playerWhoPlayed.card_count === 0) {
    newRoomStatus = "COMPLETED";
    newWinnerPlayerId = playerId;
  }

  const updatedPileCards = [...room.pile_cards, ...cardsToPlay];
  const nextPlayerIndex = getNextPlayerIndex(
    room.current_player_index,
    room.turn_order_player_ids.length
  );

  const playerName =
    room.players.find((p: Player) => p.id === playerId)?.name ||
    "لاعب غير معروف";
  let updatedGameLog = room.game_log;

  if (room.pile_cards_count === 0) {
    updatedGameLog = [];
  }
  updatedGameLog.push(
    `${playerName} لعب ${cardsToPlay.length} بطاقة (بطاقات) معلناً أنها ${declaredRank}.`
  );

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
      last_played_cards_actual: cardsToPlay,
      declared_rank: declaredRank,
      current_player_index: nextPlayerIndex,
      last_player_to_play_id: playerId,
      consecutive_skips_count: 0,
      game_log: updatedGameLog,
      status: newRoomStatus,
      winner_player_id: newWinnerPlayerId,
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to play cards: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function skipTurn(
  roomId: string,
  playerId: string
): Promise<Room> {
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

  const currentPlayerIdInTurnOrder =
    room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to skip.");
  }

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
  let newDeclaredRank = room.declared_rank;

  const playerName =
    room.players.find((p: Player) => p.id === playerId)?.name ||
    "لاعب غير معروف";
  const updatedGameLog = [...room.game_log, `${playerName} تخطى دوره.`];

  if (
    updatedConsecutiveSkips === numPlayers - 1 &&
    room.last_player_to_play_id
  ) {
    nextPlayerIndex = room.turn_order_player_ids.indexOf(
      room.last_player_to_play_id
    );
    updatedConsecutiveSkips = 0;
    newDeclaredRank = null;
    updatedGameLog.push(
      `عاد الدور إلى ${
        room.players.find((p: Player) => p.id === room.last_player_to_play_id)
          ?.name || "اللاعب السابق"
      }. يجب عليه اللعب وإعلان رتبة جديدة.`
    );
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      current_player_index: nextPlayerIndex,
      consecutive_skips_count: updatedConsecutiveSkips,
      declared_rank: newDeclaredRank,
      game_log: updatedGameLog,
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to skip turn: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function callLie(
  roomId: string,
  callingPlayerId: string
): Promise<Room> {
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

  if (room.last_played_by_player_id === callingPlayerId) {
    throw new Error("You cannot call a lie on yourself.");
  }

  const actualRankOfPlayedCards = room.last_played_cards_actual.every(
    (card: Card) => card.rank === room.declared_rank
  );
  const playerWhoPlayedId = room.last_played_by_player_id;
  const pileCards = room.pile_cards;

  let updatedPlayers = room.players;
  let nextPlayerIndex: number;
  let lieCallMessage: string;
  let newRoomStatus = room.status;
  let newWinnerPlayerId = room.winner_player_id;

  const callingPlayerName =
    room.players.find((p: Player) => p.id === callingPlayerId)?.name ||
    "لاعب غير معروف";
  const playedPlayerName =
    room.players.find((p: Player) => p.id === playerWhoPlayedId)?.name ||
    "لاعب غير معروف";

  if (!actualRankOfPlayedCards) {
    updatedPlayers = updatedPlayers.map((p: Player) => {
      if (p.id === playerWhoPlayedId) {
        const newHand = [...p.hand_cards, ...pileCards];
        return {
          ...p,
          hand_cards: newHand,
          card_count: newHand.length,
        };
      }
      return p;
    });
    nextPlayerIndex = room.turn_order_player_ids.indexOf(callingPlayerId);
    lieCallMessage = `${callingPlayerName} اتهم ${playedPlayerName} بالكذب! ${playedPlayerName} كان يكذب وأخذ جميع البطاقات. الدور الآن لـ ${callingPlayerName}.`;
  } else {
    updatedPlayers = updatedPlayers.map((p: Player) => {
      if (p.id === callingPlayerId) {
        const newHand = [...p.hand_cards, ...pileCards];
        return {
          ...p,
          hand_cards: newHand,
          card_count: newHand.length,
        };
      }
      return p;
    });
    nextPlayerIndex = room.turn_order_player_ids.indexOf(playerWhoPlayedId);
    lieCallMessage = `${callingPlayerName} اتهم ${playedPlayerName} بالكذب! ${playedPlayerName} كان يقول الحقيقة. ${callingPlayerName} أخذ جميع البطاقات. الدور الآن لـ ${playedPlayerName}.`;
  }

  updatedPlayers.forEach((p: Player) => {
    if (p.card_count === 0) {
      newRoomStatus = "COMPLETED";
      newWinnerPlayerId = p.id;
      lieCallMessage += ` ${p.name} فاز باللعبة!`;
    }
  });

  const updatedGameLog = [lieCallMessage];

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      players: updatedPlayers,
      pile_cards: [],
      pile_cards_count: 0,
      last_played_by_player_id: null,
      last_played_cards_actual: null,
      declared_rank: null,
      current_player_index: nextPlayerIndex,
      consecutive_skips_count: 0,
      game_log: updatedGameLog,
      status: newRoomStatus,
      winner_player_id: newWinnerPlayerId,
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to call lie: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function discardQuads(
  roomId: string,
  playerId: string,
  rankToDiscard: string
): Promise<Room> {
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

  const currentPlayerIdInTurnOrder =
    room.turn_order_player_ids[room.current_player_index];
  if (currentPlayerIdInTurnOrder !== playerId) {
    throw new Error("It's not your turn to discard cards.");
  }

  let updatedPlayers = room.players.map((p: Player) => {
    if (p.id === playerId) {
      let currentHand = [...p.hand_cards];
      const cardsToRemove: Card[] = [];
      const suitsFound: Set<string> = new Set();

      const cardsOfRank = currentHand.filter(
        (card) => card.rank === rankToDiscard
      );

      if (cardsOfRank.length === 4) {
        let hasAllSuits = true;
        for (const card of cardsOfRank) {
          if (suitsFound.has(card.suit)) {
            hasAllSuits = false;
            break;
          }
          suitsFound.add(card.suit);
        }

        if (hasAllSuits && suitsFound.size === 4) {
          currentHand = currentHand.filter(
            (card) => card.rank !== rankToDiscard
          );
          cardsToRemove.push(...cardsOfRank);
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
  );
  let newRoomStatus = room.status;
  let newWinnerPlayerId = room.winner_player_id;

  if (playerWhoDiscarded && playerWhoDiscarded.card_count === 0) {
    newRoomStatus = "COMPLETED";
    newWinnerPlayerId = playerId;
  }

  const playerName =
    room.players.find((p: Player) => p.id === playerId)?.name ||
    "لاعب غير معروف";
  const discardMessage = `${playerName} تخلص من أربع بطاقات من رتبة ${rankToDiscard}.`;
  let updatedGameLog = [...room.game_log, discardMessage];

  if (newRoomStatus === "COMPLETED") {
    updatedGameLog.push(`${playerName} فاز باللعبة!`);
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("room")
    .update({
      players: updatedPlayers,
      game_log: updatedGameLog,
      status: newRoomStatus,
      winner_player_id: newWinnerPlayerId,
    })
    .eq("id", roomId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to discard cards: ${updateError.message}`);
  }

  return updatedRoom as Room;
}

export async function leaveRoom(
  roomId: string,
  playerId: string
): Promise<void> {
  const { data: room, error: fetchError } = await supabase
    .from("room")
    .select("players, host_player_id, turn_order_player_ids, game_log")
    .eq("id", roomId)
    .single();

  if (fetchError || !room) {
    throw new Error("الغرفة غير موجودة أو حدث خطأ أثناء المغادرة.");
  }

  const leavingPlayer = room.players.find((p: Player) => p.id === playerId);
  if (!leavingPlayer) {
    throw new Error("اللاعب غير موجود في هذه الغرفة.");
  }

  let updatedPlayers = room.players.filter((p: Player) => p.id !== playerId);
  let updatedHostPlayerId = room.host_player_id;
  let updatedTurnOrderPlayerIds = room.turn_order_player_ids.filter(
    (id: string) => id !== playerId
  );
  let updatedGameLog = [...room.game_log, `${leavingPlayer.name} غادر الغرفة.`];

  if (leavingPlayer.is_host && updatedPlayers.length > 0) {
    updatedPlayers[0] = { ...updatedPlayers[0], is_host: true };
    updatedHostPlayerId = updatedPlayers[0].id;
    updatedGameLog.push(`تم تعيين ${updatedPlayers[0].name} كمضيف جديد.`);
  }

  if (updatedPlayers.length === 0) {
    const { error: deleteError } = await supabase
      .from("room")
      .delete()
      .eq("id", roomId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  } else {
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
      throw new Error(updateError.message);
    }
  }
}
