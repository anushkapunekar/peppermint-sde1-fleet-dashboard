# Answers

## 1. What holds the fleet's state as data arrives, and why that shape?

The frontend keeps the current fleet state as an object keyed by obot_id. createInitialState() creates this structure and pplyEventsAtTime() reconstructs replay state by applying events in timestamp order. Live mode updates the same state shape inside the live simulation interval. This allows the same filtering, statistics, robot details and visualization logic to work for both Replay and Live modes.

## 2. Name one real tradeoff you made.

I chose to simulate the live feed entirely in the browser rather than introducing a backend service or WebSocket server. This keeps Assignment 1 self-contained and makes the deployed application easy to host without additional infrastructure. The tradeoff is that the live feed is a client-side simulation rather than a real producer/consumer stream. The assignment explicitly allows the live feed to be generated purely within the frontend.

## 3. What did you leave out, and what would you build next?

I left out a backend/WebSocket architecture, persistent history and richer task-event workflows because they were outside the frontend assignment and the requested timebox. Given more time, I would add a real streaming service, reconnect handling, persistent fleet history, richer robot event history and automated tests around state reconstruction and live-state transitions.
