# Hook: on-session-start

Run this hook when a new agent session starts.

## Inputs

- `session_id`
- `workspace_path`
- `dispatch_id` (if available)
- `blueprint_id` (if available)
- `started_at` (ISO-8601 timestamp)

## Actions

1. Persist a start record to memory-store:
   - key: `citadel/sessions/{session_id}/start`
   - value:
     - `session_id`
     - `dispatch_id`
     - `blueprint_id`
     - `workspace_path`
     - `started_at`
2. Emit telemetry with `recordCbfSessionStarted(...)` from
   `apps/code/src/main/services/datadog-telemetry/cbf-metrics.ts`, including
   `dispatch_id` and `blueprint_id` tags when present.

## Outcome

- Session start is persisted for continuity.
- `cbf.session.started` is emitted for dashboard and correlation use.