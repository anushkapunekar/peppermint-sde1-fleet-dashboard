import { describe, expect, it } from "vitest";
import {
  createInitialState,
  applyEventsAtTime,
} from "../fleetState.js";

const robots = [
  {
    robot_id: "r1",
    robot_type: "cleaning",
    start: { x: 10, y: 20 },
  },
  {
    robot_id: "r2",
    robot_type: "mowing",
    start: { x: 30, y: 40 },
  },
];

const events = [
  {
    t: 5,
    robot_id: "r1",
    x: 15,
    y: 25,
    battery: 90,
    status: "active",
  },
  {
    t: 10,
    robot_id: "r2",
    x: 35,
    y: 45,
    battery: 80,
    status: "on_mission",
  },
  {
    t: 15,
    robot_id: "r1",
    x: 20,
    y: 30,
    battery: 75,
    status: "charging",
  },
];

describe("fleet state", () => {
  it("creates the initial state for every robot", () => {
    const state = createInitialState(robots);

    expect(Object.keys(state)).toHaveLength(2);
    expect(state.r1.x).toBe(10);
    expect(state.r1.y).toBe(20);
    expect(state.r1.battery).toBe(100);
    expect(state.r1.status).toBe("idle");
  });

  it("reconstructs the fleet state at a replay timestamp", () => {
    const state = applyEventsAtTime(robots, events, 10);

    expect(state.r1.x).toBe(15);
    expect(state.r1.y).toBe(25);
    expect(state.r1.battery).toBe(90);
    expect(state.r1.status).toBe("active");

    expect(state.r2.x).toBe(35);
    expect(state.r2.y).toBe(45);
    expect(state.r2.battery).toBe(80);
    expect(state.r2.status).toBe("on_mission");
  });

  it("does not apply events after the replay timestamp", () => {
    const state = applyEventsAtTime(robots, events, 12);

    expect(state.r1.status).toBe("active");
    expect(state.r1.battery).toBe(90);
  });
});
