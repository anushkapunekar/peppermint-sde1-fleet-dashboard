import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

const SPEEDS = [1, 2, 5, 10];

const ATTENTION_STATUSES = new Set([
  "blocked",
  "error",
  "maintenance",
  "offline",
]);

const WORKING_STATUSES = new Set(["active", "on_mission"]);

function isAttention(robot) {
  return (
    ATTENTION_STATUSES.has(robot.status) ||
    Number(robot.battery) < 20
  );
}

function isWorking(robot) {
  return WORKING_STATUSES.has(robot.status);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
}

function statusLabel(status) {
  return status.replaceAll("_", " ");
}

function createInitialState(robots) {
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

function applyEventsAtTime(robots, events, time) {
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

function calculateTrend(robots, events) {
  const timestamps = [...new Set(events.map((event) => event.t))].sort(
    (a, b) => a - b
  );

  return timestamps.map((time) => {
    const state = applyEventsAtTime(robots, events, time);
    const values = Object.values(state);

    const activeCount = values.filter(isWorking).length;
    const activePercent =
      values.length > 0 ? (activeCount / values.length) * 100 : 0;

    return {
      time,
      label: formatTime(time),
      active: Number(activePercent.toFixed(1)),
    };
  });
}

function App() {
  const [robots, setRobots] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [mode, setMode] = useState("replay");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);

  const [selectedRobotId, setSelectedRobotId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [liveState, setLiveState] = useState({});

  useEffect(() => {
    async function loadData() {
      try {
        const [robotsResponse, eventsResponse] = await Promise.all([
          fetch("/robots.json"),
          fetch("/events.jsonl"),
        ]);

        if (!robotsResponse.ok || !eventsResponse.ok) {
          throw new Error("Unable to load challenge data.");
        }

        const robotData = await robotsResponse.json();
        const eventText = await eventsResponse.text();

        const eventData = eventText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .sort((a, b) => a.t - b.t);

        setRobots(robotData);
        setEvents(eventData);

        setLiveState(createInitialState(robotData));
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoadError(error.message);
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const replayState = useMemo(() => {
    if (!robots.length) return {};

    return applyEventsAtTime(
      robots,
      events,
      currentTime
    );
  }, [robots, events, currentTime]);

  const displayedState =
    mode === "replay" ? replayState : liveState;

  const trendData = useMemo(
    () => calculateTrend(robots, events),
    [robots, events]
  );

  const displayedRobots = useMemo(() => {
    return robots.filter((robot) => {
      const state = displayedState[robot.robot_id];

      if (!state) return false;

      const searchValue = search.trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        robot.robot_id.toLowerCase().includes(searchValue) ||
        robot.robot_type.toLowerCase().includes(searchValue) ||
        state.status.toLowerCase().includes(searchValue);

      let matchesFilter = true;

      if (filter === "working") {
        matchesFilter = isWorking(state);
      }

      if (filter === "attention") {
        matchesFilter = isAttention(state);
      }

      if (filter === "charging") {
        matchesFilter = state.status === "charging";
      }

      if (filter === "offline") {
        matchesFilter = state.status === "offline";
      }

      return matchesSearch && matchesFilter;
    });
  }, [robots, displayedState, search, filter]);

  const selectedRobot = selectedRobotId
    ? robots.find(
        (robot) => robot.robot_id === selectedRobotId
      )
    : null;

  const selectedState = selectedRobot
    ? displayedState[selectedRobot.robot_id]
    : null;

  const fleetStats = useMemo(() => {
    const values = Object.values(displayedState);

    return {
      total: values.length,
      working: values.filter(isWorking).length,
      charging: values.filter(
        (robot) => robot.status === "charging"
      ).length,
      attention: values.filter(isAttention).length,
      offline: values.filter(
        (robot) => robot.status === "offline"
      ).length,
    };
  }, [displayedState]);

  useEffect(() => {
    if (
      !playing ||
      mode !== "replay" ||
      events.length === 0
    ) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCurrentTime((previous) => {
        const next = previous + 1 * speed;

        if (next >= 900) {
          setPlaying(false);
          return 900;
        }

        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [playing, speed, mode, events.length]);

  useEffect(() => {
    if (mode !== "live" || !robots.length) {
      return undefined;
    }

    setLiveState((previous) => {
      if (Object.keys(previous).length) return previous;

      return createInitialState(robots);
    });

    const timer = setInterval(() => {
      setLiveState((previous) => {
        const next = { ...previous };

        for (const robot of robots) {
          const current = next[robot.robot_id];

          if (!current) continue;

          let status = current.status;
          const battery = Number(current.battery);

          if (battery <= 12) {
            status = "charging";
          } else if (
            status === "charging" &&
            battery >= 90
          ) {
            status = "idle";
          } else if (Math.random() < 0.015) {
            const transitions = [
              "idle",
              "active",
              "on_mission",
              "charging",
            ];

            status =
              transitions[
                Math.floor(
                  Math.random() * transitions.length
                )
              ];
          }

          const movementScale =
            status === "charging" ? 0.15 : 2.5;

          const dx =
            (Math.random() - 0.5) * movementScale;

          const dy =
            (Math.random() - 0.5) * movementScale;

          const nextBattery =
            status === "charging"
              ? Math.min(100, battery + 0.35)
              : Math.max(0, battery - 0.08);

          next[robot.robot_id] = {
            ...current,
            x: Math.max(
              0,
              Math.min(899, current.x + dx)
            ),
            y: Math.max(
              0,
              Math.min(559, current.y + dy)
            ),
            battery: Number(nextBattery.toFixed(1)),
            status,
          };
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, robots]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setPlaying(false);

    if (nextMode === "live") {
      setSelectedRobotId(null);
    }
  }

  function resetReplay() {
    setCurrentTime(0);
    setPlaying(false);
    setSelectedRobotId(null);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />

          <h2>Loading fleet data</h2>

          <p>
            Preparing the Peppermint Robotics
            dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="loading-screen">
        <div className="error-card">
          <h2>Unable to load fleet data</h2>

          <p>{loadError}</p>

          <p>
            Make sure events.jsonl, robots.json and
            layout.png are inside the public folder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>

          <div>
            <div className="eyebrow">
              PEPPERMINT ROBOTICS
            </div>

            <h1>Fleet Operations</h1>

            <p className="subtitle">
              Real-time robot fleet monitoring & site
              intelligence
            </p>
          </div>
        </div>

        <div className="mode-switch">
          <button
            className={
              mode === "replay"
                ? "mode active"
                : "mode"
            }
            onClick={() => switchMode("replay")}
          >
            Replay
          </button>

          <button
            className={
              mode === "live"
                ? "mode live active"
                : "mode live"
            }
            onClick={() => switchMode("live")}
          >
            <span className="live-dot" />
            Live feed
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">
              Total robots
            </span>

            <strong>{fleetStats.total}</strong>

            <span className="stat-note">
              Fleet size
            </span>
          </div>

          <div className="stat-card working-card">
            <span className="stat-label">
              Working
            </span>

            <strong>{fleetStats.working}</strong>

            <span className="stat-note">
              Active / on mission
            </span>
          </div>

          <div className="stat-card charging-card">
            <span className="stat-label">
              Charging
            </span>

            <strong>{fleetStats.charging}</strong>

            <span className="stat-note">
              Currently charging
            </span>
          </div>

          <div className="stat-card attention-card">
            <span className="stat-label">
              Needs attention
            </span>

            <strong>{fleetStats.attention}</strong>

            <span className="stat-note">
              Blocked, error, maintenance or low battery
            </span>
          </div>
        </section>

        {mode === "replay" && (
          <section className="replay-panel">
            <div className="replay-header">
              <div>
                <span className="section-kicker">
                  RECORDED WINDOW
                </span>

                <h2>Event replay</h2>
              </div>

              <div className="replay-time">
                {formatTime(currentTime)}

                <span>/ 15:00</span>
              </div>
            </div>

            <div className="replay-controls">
              <button
                className="primary-button"
                onClick={() => {
                  if (currentTime >= 900) {
                    return;
                  }

                  setPlaying((value) => !value);
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>

              <button
                className="secondary-button"
                onClick={resetReplay}
              >
                Reset
              </button>

              <div className="speed-control">
                <span>Speed</span>

                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    className={
                      speed === value
                        ? "speed active"
                        : "speed"
                    }
                    onClick={() => setSpeed(value)}
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </div>

            <input
              className="timeline"
              type="range"
              min="0"
              max="900"
              step="1"
              value={currentTime}
              onChange={(event) => {
                setCurrentTime(
                  Number(event.target.value)
                );
                setPlaying(false);
              }}
            />

            <div className="timeline-labels">
              <span>00:00</span>
              <span>05:00</span>
              <span>10:00</span>
              <span>15:00</span>
            </div>
          </section>
        )}

        <section className="content-grid">
          <div className="main-column">
            <section className="panel map-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">
                    SITE MAP
                  </span>

                  <h2>Robot positions</h2>
                </div>

                <div className="map-status">
                  <span className="status-dot working" />

                  {mode === "live"
                    ? "Live simulation"
                    : "Replay position"}
                </div>
              </div>

              <div className="map-wrapper">
                <img
                  className="site-map"
                  src="/layout.png"
                  alt="Peppermint Robotics site layout"
                />

                {robots.map((robot) => {
                  const state =
                    displayedState[robot.robot_id];

                  if (!state) return null;

                  const attention =
                    isAttention(state);

                  const selected =
                    selectedRobotId ===
                    robot.robot_id;

                  return (
                    <button
                      key={robot.robot_id}
                      className={`robot-marker ${
                        attention
                          ? "attention"
                          : ""
                      } ${
                        selected
                          ? "selected"
                          : ""
                      }`}
                      style={{
                        left: `${
                          (state.x / 900) * 100
                        }%`,
                        top: `${
                          (state.y / 560) * 100
                        }%`,
                      }}
                      onClick={() =>
                        setSelectedRobotId(
                          robot.robot_id
                        )
                      }
                      title={`${robot.robot_id} — ${statusLabel(
                        state.status
                      )}`}
                    >
                      <span className="robot-pulse" />

                      <span className="robot-icon">
                        ◆
                      </span>

                      <span className="robot-id">
                        {robot.robot_id.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="map-legend">
                <span>
                  <i className="legend-dot normal" />
                  Normal
                </span>

                <span>
                  <i className="legend-dot warning" />
                  Needs attention
                </span>

                <span>900 × 560 units</span>
              </div>
            </section>

            <section className="panel trend-panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">
                    FLEET TREND
                  </span>

                  <h2>Active fleet over time</h2>
                </div>

                <div className="trend-value">
                  {mode === "live"
                    ? `${
                        fleetStats.total
                          ? Math.round(
                              (fleetStats.working /
                                fleetStats.total) *
                                100
                            )
                          : 0
                      }%`
                    : trendData.length
                      ? `${
                          trendData[
                            Math.min(
                              trendData.length - 1,
                              Math.floor(
                                (currentTime / 900) *
                                  trendData.length
                              )
                            )
                          ].active
                        }%`
                      : "—"}

                  <span>
                    {mode === "live"
                      ? "active in live fleet"
                      : "active at replay position"}
                  </span>
                </div>
              </div>

              <div className="chart-container">
                <ResponsiveContainer
                  width="100%"
                  height={250}
                >
                  <LineChart data={trendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      minTickGap={35}
                    />

                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) =>
                        `${value}%`
                      }
                      tick={{ fontSize: 11 }}
                    />

                    <Tooltip
                      formatter={(value) => [
                        `${value}%`,
                        "Active fleet",
                      ]}
                      labelFormatter={(label) =>
                        `Time ${label}`
                      }
                    />

                    <Line
                      type="monotone"
                      dataKey="active"
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <aside className="side-column">
            <section className="panel fleet-panel">
              <div className="panel-header compact">
                <div>
                  <span className="section-kicker">
                    FLEET
                  </span>

                  <h2>Robots</h2>
                </div>

                <span className="robot-count">
                  {displayedRobots.length}/
                  {robots.length}
                </span>
              </div>

              <div className="search-box">
                <span>⌕</span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search robot, type or status..."
                />
              </div>

              <div className="filter-row">
                {[
                  ["all", "All"],
                  ["working", "Working"],
                  ["attention", "Attention"],
                  ["charging", "Charging"],
                  ["offline", "Offline"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={
                      filter === value
                        ? "filter active"
                        : "filter"
                    }
                    onClick={() =>
                      setFilter(value)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="robot-list">
                {displayedRobots.map((robot) => {
                  const state =
                    displayedState[
                      robot.robot_id
                    ];

                  const attention =
                    isAttention(state);

                  const selected =
                    selectedRobotId ===
                    robot.robot_id;

                  return (
                    <button
                      key={robot.robot_id}
                      className={`robot-row ${
                        selected
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedRobotId(
                          robot.robot_id
                        )
                      }
                    >
                      <span
                        className={`row-status ${
                          attention
                            ? "attention"
                            : "normal"
                        }`}
                      />

                      <span className="row-main">
                        <strong>
                          {robot.robot_id.toUpperCase()}
                        </strong>

                        <small>
                          {robot.robot_type}
                        </small>
                      </span>

                      <span className="row-right">
                        <strong>
                          {Math.round(
                            state.battery
                          )}
                          %
                        </strong>

                        <small>
                          {statusLabel(
                            state.status
                          )}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedRobot && selectedState && (
              <section className="panel details-panel">
                <div className="panel-header compact">
                  <div>
                    <span className="section-kicker">
                      ROBOT DETAILS
                    </span>

                    <h2>
                      {selectedRobot.robot_id.toUpperCase()}
                    </h2>
                  </div>

                  <button
                    className="close-button"
                    onClick={() =>
                      setSelectedRobotId(null)
                    }
                  >
                    ×
                  </button>
                </div>

                <div className="detail-type">
                  {selectedRobot.robot_type}
                </div>

                <div
                  className={`detail-status ${
                    isAttention(selectedState)
                      ? "attention"
                      : "normal"
                  }`}
                >
                  <span className="status-dot" />

                  {statusLabel(
                    selectedState.status
                  )}
                </div>

                <div className="battery-block">
                  <div className="detail-label">
                    <span>Battery</span>

                    <strong>
                      {Number(
                        selectedState.battery
                      ).toFixed(1)}
                      %
                    </strong>
                  </div>

                  <div className="battery-track">
                    <div
                      className={`battery-fill ${
                        Number(
                          selectedState.battery
                        ) < 20
                          ? "low"
                          : ""
                      }`}
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            selectedState.battery
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="details-grid">
                  <div>
                    <span>X position</span>

                    <strong>
                      {Number(
                        selectedState.x
                      ).toFixed(1)}
                    </strong>
                  </div>

                  <div>
                    <span>Y position</span>

                    <strong>
                      {Number(
                        selectedState.y
                      ).toFixed(1)}
                    </strong>
                  </div>

                  <div>
                    <span>Robot type</span>

                    <strong>
                      {selectedRobot.robot_type}
                    </strong>
                  </div>

                  <div>
                    <span>Mode</span>

                    <strong>
                      {mode === "live"
                        ? "Live"
                        : "Replay"}
                    </strong>
                  </div>
                </div>

                {isAttention(selectedState) && (
                  <div className="attention-message">
                    <strong>
                      Operator attention required
                    </strong>

                    <span>
                      Review the robot's current
                      status and battery before
                      continuing its operation.
                    </span>
                  </div>
                )}
              </section>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;