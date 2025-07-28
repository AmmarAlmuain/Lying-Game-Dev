
# Multiplayer Card Game (React Native)

This project is a real-time multiplayer card game built with React Native, leveraging Supabase for backend services, real-time updates. It provides a seamless and interactive experience for players to join rooms, play cards, and interact within a game session.

## Table of Contents

-   [Multiplayer Card Game (React Native)](https://www.google.com/search?q=%23multiplayer-card-game-react-native "null")
    
    -   [Introduction](https://www.google.com/search?q=%23introduction "null")
        
    -   [Features](https://www.google.com/search?q=%23features "null")
        
    -   [Technology Stack](https://www.google.com/search?q=%23technology-stack "null")
        
    -   [Project Structure](https://www.google.com/search?q=%23project-structure "null")
        
    -   [Getting Started](https://www.google.com/search?q=%23getting-started "null")
        
        -   [Prerequisites](https://www.google.com/search?q=%23prerequisites "null")
            
        -   [Installation](https://www.google.com/search?q=%23installation "null")
            
        -   [Running the Application](https://www.google.com/search?q=%23running-the-application "null")
            
    -   [Game Flow](https://www.google.com/search?q=%23game-flow "null")
        
    -   [Backend (Supabase)](https://www.google.com/search?q=%23backend-supabase "null")
        
    -   [Design](https://www.google.com/search?q=%23design "null")
        
    -   [Localization & Demo](https://www.google.com/search?q=%23localization--demo "null")
        
    -   [Contributing](https://www.google.com/search?q=%23contributing "null")
        
    -   [License](https://www.google.com/search?q=%23license "null")
        

## Introduction

This application is a dynamic multiplayer card game designed for mobile platforms using React Native. It focuses on providing a smooth real-time multiplayer experience, allowing users to create or join game rooms, manage their turns, and interact with other players. The game logic and state are managed efficiently with a Supabase backend, ensuring data synchronization across all connected clients.

## Features

-   **Player Session Management:** Automatically initializes and manages unique player sessions, persisting player names.
    
-   **Room Management:**
    
    -   Create new game rooms with unique codes.
        
    -   Join existing game rooms using a room code.
        
    -   Automatic reconnection to the last joined room.
        
    -   Leave rooms gracefully.
        
-   **Real-time Game Updates:** Utilizes Supabase's real-time capabilities to synchronize game state, player actions, and room information across all participants instantly.
    
-   **Game Actions:**
    
    -   Start a game within a lobby (requires at least two players).
        
    -   Select and play cards.
        
    -   Declare card ranks during play.
        
    -   Skip turns.
        
    -   "Call Lie" functionality (specific to certain card games).
        
    -   Discard "quads" (four cards of the same rank).
        
-   **Intuitive User Interface:** Navigates between Welcome, Lobby Selection, and Game screens.
    
-   **Error Handling:** Provides user-friendly alerts for various operational failures (e.g., connection issues, invalid inputs, game rule violations).
    
-   **Local Storage:** Persists the last room code for convenient rejoining.
    

## Technology Stack

-   **React Native:** For building cross-platform mobile applications (iOS and Android).
    
-   **Expo:** The project is built with Expo, simplifying development, building, and deployment.
    
-   **TypeScript:** For type-safe JavaScript development.
    
-   **Supabase:** As the backend-as-a-service, providing:
    
    -   **PostgreSQL Database:** For storing game and player data.
        
    -   **Realtime Subscriptions:** For instant updates on game state changes.
        
-   **`@react-native-async-storage/async-storage`:** For client-side data persistence.
    
-   **Tailwind CSS (via a React Native styling solution, inferred):** For utility-first CSS styling, enabling rapid UI development and responsiveness.
    
-   **`react-native-url-polyfill` & `react-native-get-random-values`:** For compatibility and cryptographic randomness in the React Native environment.
    

## Project Structure

The core application logic resides in `index.tsx`, which manages the overall application state, navigation between screens, and interactions with the Supabase backend.

-   **`index.tsx` (Main Component):**
    
    -   Manages global state for loading, current player, room information, selected cards, and navigation (`currentPage`).
        
    -   Handles initial player session initialization and attempts to rejoin previous rooms.
        
    -   Establishes real-time subscriptions to `room` and `players` tables in Supabase for live updates.
        
    -   Contains callback functions for all major game actions (e.g., `handleCreateRoom`, `handleJoinRoom`, `handlePlayCards`, `handleCallLie`).
        
    -   Renders different screens (`WelcomeScreen`, `LobbySelectionScreen`, `GameScreen`) based on the `currentPage` state.
        
-   **`./screens/` (Directory):** Contains the individual screen components:
    
    -   `WelcomeScreen`: For initial player setup and starting the game journey.
        
    -   `LobbySelectionScreen`: For creating or joining game rooms.
        
    -   `GameScreen`: The main game interface where players interact with cards, view game logs, and perform actions.
        
-   **`../services/` (Directory - inferred):** Contains modules for interacting with the Supabase backend:
    
    -   `player.ts`: Handles player session initialization (`initPlayerSession`).
        
    -   `room.ts`: Contains functions for room-related operations (`createRoom`, `joinRoom`, `startGame`, `playCards`, `skipTurn`, `callLie`, `discardQuads`, `leaveRoom`).
        
    -   `supabase.ts`: Configures and exports the Supabase client instance.
        

## Getting Started

To run this project locally, follow these steps:

### Prerequisites

-   Node.js and npm/yarn installed.
    
-   [Expo CLI](https://docs.expo.dev/get-started/installation/ "null") installed globally (`npm install -g expo-cli`).
    
-   A React Native development environment set up (refer to the [official React Native documentation](https://reactnative.dev/docs/environment-setup "null")).
    
-   A Supabase project configured with `room` and `players` tables, and appropriate real-time enabled. You'll need your Supabase URL and `anon` key.
    

### Installation

1.  **Clone the repository:**
    
    ```
    git clone <your-repo-url>
    cd <your-project-directory>
    
    ```
    
2.  **Install dependencies:**
    
    ```
    npm install
    # or
    yarn install
    
    ```
    
3.  **Configure Supabase Environment Variables:** This project uses environment variables for Supabase credentials (e.g., `SUPABASE_URL`, `SUPABASE_ANON_KEY`). You can configure these in your Expo project's `app.config.js` or through a `.env` file if you're using a library like `react-native-dotenv` or `babel-plugin-inline-dotenv`.
    
    Example for `.env` file:
    
    ```
    SUPABASE_URL="https://your-supabase-project.supabase.co"
    SUPABASE_ANON_KEY="your-supabase-anon-key"
    
    ```
    
    Make sure your `supabase.ts` file correctly imports these:
    
    ```
    // services/supabase.ts
    import { createClient, SupabaseClient } from "@supabase/supabase-js";
    import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@env"; // This import depends on your env setup
    
    const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    export default supabase;
    
    ```
    
    _Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual Supabase project credentials._
    

### Running the Application

1.  **Start the Expo development server:**
    
    ```
    expo start
    
    ```
    
2.  **Run on a simulator/device:**
    
    -   Scan the QR code with the Expo Go app on your mobile device.
        
    -   Press `i` for iOS simulator or `a` for Android emulator in the terminal.
        

## Game Flow

1.  **Welcome Screen:** Players enter their name (or use a pre-set one).
    
2.  **Lobby Selection Screen:** Players can choose to create a new room or join an existing one by entering a room code.
    
3.  **Game Screen:**
    
    -   Players wait in the lobby until the host starts the game.
        
    -   During gameplay, players can select cards from their hand, declare a rank, and play them.
        
    -   Options to skip a turn, call a lie, or discard quads are available based on game state.
        
    -   Real-time updates ensure all players see the current game state, played cards, and turn progression.
        

## Backend (Supabase)

Supabase serves as the robust backend for this application, handling:

-   **Database:** Stores room information, game state, and card data.
    
-   **Realtime:** Powers the live updates for game actions and room changes, ensuring all connected clients are in sync without constant polling.
    
-   **API:** Provides a simple and secure way for the React Native client to interact with the database.
    

Ensure your Supabase tables (`room`, `players`, and any other related tables for cards/game state) are correctly set up with appropriate RLS (Row Level Security) policies to allow authenticated users to read and write their own data and public room data.

## Design

The application's user interface is designed in Figma, ensuring a consistent and appealing visual experience across the different screens and game elements.

[https://www.figma.com/design/v2OJta4KxXHAXiVzs3gU6I/Untitled?node-id=0-1&t=GvlYahGisu2OmZSE-1](https://www.figma.com/design/v2OJta4KxXHAXiVzs3gU6I/Untitled?node-id=0-1&t=GvlYahGisu2OmZSE-1 "null")
## Localization & Demo

The current version of the game's APK is localized in Arabic. You can access a demo of the game via this link:

[https://limewire.com/d/WCVvR#xHmv6XMY86](https://limewire.com/d/WCVvR#xHmv6XMY86 "null")

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.
