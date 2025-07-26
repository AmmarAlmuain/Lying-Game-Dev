interface Card {
  rank: string;
  suit: string;
}

interface Player {
  id: string;
  name: string;
  is_host?: boolean;
  hand_cards?: Card[];
  card_count?: number;
}

interface Room {
  id: string;
  room_code?: string | null;
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED";
  current_player_index: number;
  declared_rank?: string | null;
  pile_cards_count: number;
  pile_cards: Card[];
  last_played_by_player_id?: string | null;
  last_played_cards_actual?: Card[] | null;
  turn_order_player_ids: string[];
  host_player_id: string;
  created_at: string;
  players: Player[];
  last_player_to_play_id?: string | null;
  consecutive_skips_count: number;
  game_log: string[];
  winner_player_id?: string | null;
}

type CurrentPage = "welcome" | "lobby_selection" | "lobby" | "game";
