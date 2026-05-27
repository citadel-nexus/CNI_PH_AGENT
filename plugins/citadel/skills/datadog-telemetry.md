---
name: datadog-telemetry
description: Query and analyze Datadog metrics, logs, traces, and monitors for the Citadel Nexus platform
alwaysApply: false
---

# Datadog Telemetry

You have access to Datadog telemetry and operational data for the Citadel Nexus platform.

## Available operations

- Metrics: query system and platform metrics
- Logs: search logs by service, host, env, status, and keywords
- Traces: inspect distributed trace spans for latency and error analysis
- Monitors: list monitor status and identify active alerts
- Events: review deployment, incident, and operational timeline events

## Citadel-specific metrics

- `cbf.pull.files_written` - files landed per CBF pull
- `cbf.pull.collisions` - file conflicts during pulls
- `cbf.pull.elapsed_ms` - CBF pull duration in milliseconds
- `cbf.pull.sink.errors` - sink emission failures
- `cbf.fleet.agents.healthy` - healthy rig agents count
- `cbf.fleet.cmd.dispatched` - dispatched remote commands
- `cbf.fleet.cmd.completed` - completed remote commands

## Suggested workflow

1. Check logs in the affected time window and service scope
2. Inspect traces for latency outliers or failure paths
3. Verify monitor state and recent events
4. Cross-check pull/fleet metrics for deploy and control-plane issues