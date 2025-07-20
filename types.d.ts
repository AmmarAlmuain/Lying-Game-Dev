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
  id: string;
  room_code: string;
  players: Player[];
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED";
  current_player_index: number;
  last_played_cards: Card[];
  last_declared_rank: string | null;
  pile_card_count: number;
  game_log: string[];
  created_at: string;
  winner_player_id: string | null;
}

type CurrentPage = "welcome" | "lobby_selection" | "lobby" | "game";
