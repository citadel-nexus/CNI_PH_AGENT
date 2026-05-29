# Hook: on-session-end

Run this hook when an agent session ends.

## Inputs

- `session_id`
- `dispatch_id` (from session start, if available)
- `status` (`success` or `failure`)
- `duration_ms`
- `tool_calls_count`
- `ended_at` (ISO-8601 timestamp)

## Actions

1. Persist an end record to memory-store:
   - key: `citadel/sessions/{session_id}/end`
   - value:
     - `session_id`
     - `dispatch_id`
     - `status`
     - `duration_ms`
     - `tool_calls_count`
     - `ended_at`
2. Update a summary key for quick lookup:
   - key: `citadel/sessions/{session_id}/summary`
   - value:
     - `dispatch_id`
     - `status`
     - `duration_ms`
     - `tool_calls_count`
3. Emit telemetry with `recordCbfSessionEnded(status, ...)` from
   `apps/code/src/main/services/datadog-telemetry/cbf-metrics.ts`, including
   the same `dispatch_id` used at session start for continuity.

## Outcome

- Session outcomes are durable in memory-store.
- `cbf.session.ended` is emitted with status correlation.