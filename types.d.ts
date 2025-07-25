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
  id: string; // NOT NULL in SQL
  room_code?: string | null; // From 'room_code text' (can be NULL)
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED"; // NOT NULL in SQL
  current_player_index: number; // NOT NULL in SQL
  declared_rank?: string | null; // From 'declared_rank text' (can be NULL)
  pile_cards_count: number; // NOT NULL in SQL
  pile_cards: Card[]; // NOT NULL in SQL
  last_played_by_player_id?: string | null; // From 'last_played_by_player_id text' (can be NULL)
  last_played_cards_actual?: Card[] | null; // From 'last_played_cards_actual jsonb' (can be NULL)
  turn_order_player_ids: string[]; // NOT NULL in SQL
  host_player_id: string; // NOT NULL in SQL
  created_at: string; // NOT NULL in SQL
  players: Player[]; // NOT NULL in SQL
  last_player_to_play_id?: string | null; // From 'last_player_to_play_id text' (can be NULL)
  consecutive_skips_count: number; // Has DEFAULT 0, so effectively not nullable
  game_log: string[]; // NOT NULL in SQL
  winner_player_id?: string | null; // From 'winner_player_id text' (can be NULL)
}

type CurrentPage = "welcome" | "lobby_selection" | "lobby" | "game";
