export function createInitialState(robots) {
  return Object.fromEntries(
    robots.map((robot) => [
      robot.robot_id,
      {
        robot_id: robot.robot_id,
        robot_type: robot.robot_type,
        x: robot.start.x,
        y: robot.start.y,
        battery: 100,
        status: "idle",
      },
    ])
  );
}

export function applyEventsAtTime(robots, events, time) {
  const state = createInitialState(robots);

  for (const event of events) {
    if (event.t > time) break;

    if (state[event.robot_id]) {
      state[event.robot_id] = {
        ...state[event.robot_id],
        x: event.x,
        y: event.y,
        battery: event.battery,
        status: event.status,
        ...(event.task_event
          ? { task_event: event.task_event }
          : {}),
      };
    }
  }

  return state;
}
