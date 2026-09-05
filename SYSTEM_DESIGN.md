# System Design

## 1. What happens if we add a new feature later?

The current design supports additional fleet-level features because robot state is centralized in App.jsx and derived views consume that state. For example, an alert history feature could be added by preserving relevant events while loading events.jsonl, then exposing a derived alert list alongside the existing fleet statistics and selected robot state. A production version could move state and domain logic into dedicated modules so additional features can be added without making App.jsx larger.

## 2. What happens if the number of robots grows from eight to five hundred?

The first pressure point would be browser rendering and repeated state calculations. The current implementation filters the roster and calculates derived fleet information in the frontend. With 500 robots, rendering hundreds of rows and repeatedly reconstructing state from the event history would become more expensive. I would introduce more efficient event indexing/state reconstruction, virtualize the robot list, and update only affected robots.

## 3. What happens if bandwidth is limited?

For a real deployment, I would avoid sending the complete robot state when only one field has changed. Updates could contain robot_id, timestamp, sequence number and only changed fields. Update frequency could also be adaptive: position updates could be less frequent when a robot is idle and more frequent while it is moving. Fleet-level aggregates could also be calculated server-side where appropriate.

## 4. What happens if a robot goes down mid-task?

The backend should track the last-seen timestamp for every robot. If no update arrives within a defined timeout, the robot should be marked stale or offline and the operator should receive an alert. A task assigned to that robot should become recoverable so an operator or scheduling service can decide whether to retry or assign another robot.

## 5. What happens if the connection between a robot and the backend is slow or unreliable?

Each robot update should contain a timestamp and preferably a monotonically increasing sequence number. The backend should reject stale updates when a newer state has already been accepted. If updates stop arriving, the robot should be marked stale rather than silently appearing healthy. When the connection recovers, the robot can resume publishing updates and the backend can replace the stale state with the newest valid state. WebSocket clients should also reconnect and receive the current authoritative fleet state after reconnecting rather than relying only on missed messages.
