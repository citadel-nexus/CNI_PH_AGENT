---
name: datadog-telemetry
description: Query and analyze Datadog metrics, logs, traces, and monitors for the Citadel Nexus platform
alwaysApply: false
---

# Datadog Telemetry

Use Datadog telemetry to investigate platform behavior before making code or configuration changes.

## Available operations

- **Metrics**: Query system and custom metrics for health, throughput, and regressions.
- **Logs**: Search logs by service, environment, host, and status.
- **Traces**: Analyze APM traces/spans to find latency and error hotspots.
- **Monitors**: Check active monitors and alert state to understand impact.
- **Events**: Review deploy and incident events for timeline correlation.

## Citadel metrics to prioritize

- `cbf.pull.files_written` — files landed per CBF pull (tagged by page and puller version)
- `cbf.pull.collisions` — file collisions during pulls
- `cbf.pull.elapsed_ms` — pull duration
- `cbf.pull.sink.errors` — sink emission failures
- `cbf.fleet.agents.healthy` — healthy rig agents
- `cbf.fleet.cmd.dispatched` — commands sent to fleet
- `cbf.fleet.cmd.completed` — commands completed by fleet

## Investigation flow

1. Check logs for failing service and timeframe.
2. Check traces for latency spikes or failed spans.
3. Verify monitor state and related events.
4. Correlate CBF pull/fleet metrics (`cbf.pull.*`, `cbf.fleet.*`) with observed failures.