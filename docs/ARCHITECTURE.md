# Management App Architecture

## Product Intent
- The app is being repurposed from posture tracking into a personal background manager for focus and movement.
- The core workflow is session-driven: users run either a Pomodoro focus session or a Deep Work focus session.
- Pomodoro sessions are 25 minutes of focus followed by a 5 minute break.
- Deep Work sessions are 90 minutes of focus followed by a long break: 5 minutes of guided exercise then 10 minutes of relax (`SESSION_DURATIONS_MINUTES` in `src/lib/workoutPlanner.ts`, driven by `src/context/SessionContext.tsx`).
- After each Pomodoro focus session, the break includes a short guided workout and a sit/stand switch reminder.
- Pomodoro sessions auto-schedule another Pomodoro session by default after the break.
- Users can remove the following focus session or switch the next scheduled focus session between Pomodoro and Deep Work; a break is not labeled as a “session” in the UI.
- The app tracks and displays completed exercise totals for the current session and over long periods (weeks/months).
- The app tracks how many Deep Work sessions were completed during the current day.

## Repository layout
- `src/`: React UI, session engine, posture TypeScript (`src/posture/`), shared libs (`src/lib/`).
- `src-tauri/src/main.rs`: Tauri app entry, tray, background camera loop, SQL migrations, posture ingest command.
- `src-tauri/src/posture_bridge.rs`: posture debouncer and ingest payload types used from `main.rs`.

## Frontend Runtime
- The desktop app uses Tauri with a React + TypeScript frontend (`src/main.tsx` → `src/App.tsx`).
- Posture landmarks and scoring run in the webview using MediaPipe Tasks (`@mediapipe/tasks-vision`) with the weighted metric pipeline adapted from [BatesPosture](https://github.com/wtbates99/batesposture); Rust captures periodic camera frames for preview and receives scored results from the frontend for ingest, SQLite logging, and desktop notifications.
- Navigation and provider wiring are summarized in the first system map below.

## Data Persistence
- Focus and workout history, plus the allowed-workout allowlist, live in browser `localStorage` under keys written by `src/context/SessionContext.tsx` (`management_allowed_workouts`, `management_workout_logs`, `management_focus_logs`).
- Posture time series live in SQLite database id `sqlite:posture_data.db` (Tauri SQL plugin); table `posture_log` is written from Rust in `submit_posture_analysis` and read from the webview via `src/lib/db.ts` and `src/posture/postureLogDb.ts`.
- Posture calibration image path is stored with `tauri_plugin_store` in `.settings.dat` from `src/components/PosturePage.tsx`; baseline metrics use `localStorage` key `mgmt_posture_baseline_v1`.
- Camera and monitoring preferences use `localStorage` keys from `src/lib/mgmtLocalStorage.ts` (`MGMT_LS`); `src/App.tsx` pushes those into Rust on startup.

## High-level system maps

These diagrams stay aligned with `src/` and `src-tauri/` whenever navigation, session flow, persistence, or Tauri boundaries change (see definition of done in docs/AGENT.md).

### UI shell, tabs, and shared state

```mermaid
flowchart TB
  subgraph app["src/App.tsx"]
    nav["Tab buttons: dashboard posture customize stats settings"]
    boot["On mount: invoke Rust settings sync from MGMT_LS keys"]
  end
  subgraph providers["Providers always mounted"]
    SP["SessionProvider src/context/SessionContext.tsx"]
    PSP["PostureSessionProvider src/context/PostureSessionContext.tsx"]
    PL["PosturePipeline src/components/PosturePipeline.tsx"]
  end
  subgraph tabs["Active tab component src/components/"]
    D["Dashboard.tsx timer chain desk posture toggle"]
    PPg["PosturePage.tsx live score charts history export"]
    CW["CustomizeWorkoutPage.tsx allowlist switches"]
    ST["StatsPage.tsx aggregates from SessionContext"]
    SE["SettingsPage.tsx camera monitoring battery restart"]
  end
  nav --> D
  nav --> PPg
  nav --> CW
  nav --> ST
  nav --> SE
  app --> SP
  app --> PSP
  app --> PL
  SP --> D
  SP --> CW
  SP --> ST
  PSP --> PPg
  PL --> PSP
```

### Session timer flow (implemented in SessionContext)

Durations and workout picking rules are centralized in `src/lib/workoutPlanner.ts`.

```mermaid
flowchart TD
  idle[Idle]
  pf[Pomodoro focus 25 min]
  df[Deep focus 90 min]
  sb[Short break 5 min with guided workout]
  lex[Long break exercise 5 min]
  lrl[Long break relax 10 min]
  nx[Next focus from nextSessionType]
  idle --> pf
  idle --> df
  pf --> sb
  df --> lex
  lex --> lrl
  sb --> nx
  lrl --> nx
  nx --> idle
  nx --> pf
  nx --> df
```

### Posture capture, scoring, and persistence (subset of the product)

```mermaid
flowchart LR
  subgraph rust["src-tauri main.rs + posture_bridge.rs"]
    caploop["Background task: continuous nokhwa stream in normal mode; ephemeral per cycle in battery-saving; releases stream when CMIO reports camera in use elsewhere (macOS)"]
    cmd["Command submit_posture_analysis"]
    tray["Tray toggles monitoring; emits monitoring-state-changed"]
  end
  subgraph ts["src/posture + components"]
    pipe["PosturePipeline: listen camera-preview-frame, MediaPipe analyzeDataUrl"]
    page["PosturePage: listen analysis-update, UI and charts"]
    dbread["postureLogDb.ts via lib db.ts plugin-sql"]
  end
  subgraph store["sqlite:posture_data.db"]
    logt["posture_log rows"]
  end
  caploop -->|"emit camera-preview-frame"| pipe
  pipe -->|"invoke submit_posture_analysis"| cmd
  cmd -->|"emit analysis-update"| page
  cmd --> logt
  dbread --> logt
  tray --> caploop
```

### Tauri commands the webview calls

Grouped by call site; all are registered on the Rust builder in `main.rs` (`invoke_handler`).

| Area | Command | Called from |
| --- | --- | --- |
| Boot | `set_current_language`, `set_battery_saving_mode`, `set_selected_camera`, `set_monitoring_interval`, `set_detection_settings` | `src/App.tsx` |
| Settings | same tuning commands plus `get_available_cameras`, `restart_app` | `src/components/SettingsPage.tsx` |
| Posture pipeline | `submit_posture_analysis` | `src/components/PosturePipeline.tsx` |
| Posture page | `initialize_pose_model`, `save_calibrated_image`, `clear_posture_debouncer`, `get_monitoring_status`, `request_preview_frame` | `src/components/PosturePage.tsx` |

### Events Rust emits and the webview listens for

| Event | Purpose | Listeners |
| --- | --- | --- |
| `camera-preview-frame` | JPEG data URL for preview or MediaPipe input | `PosturePipeline.tsx`, `PosturePage.tsx` |
| `analysis-update` | Debounced posture flags, score, recommendations, metrics JSON | `PosturePage.tsx` |
| `monitoring-state-changed` | `{ active: boolean }` tray or command driven | `PosturePipeline.tsx`, `PosturePage.tsx` |
| `camera-yield-changed` | `{ paused: boolean, reason: string }` macOS CMIO detects another app using the camera | `PosturePage.tsx` |

Tray and `start_monitoring` / `stop_monitoring` commands exist in Rust for monitoring lifecycle; the webview relies on default monitoring-on startup plus tray events rather than calling those commands directly.
