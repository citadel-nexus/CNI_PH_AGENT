---
name: signal-correlation-playbook
description: Correlate Datadog, PostHog, Supabase, and Notion/CBF signals during incident triage
alwaysApply: false
---

# Signal Correlation Playbook

Use this workflow to move from symptom to root cause with consistent cross-system evidence.

## 1) Start from impact signal

- Datadog monitor alert or incident
- PostHog issue/signal report
- CBF pull failure or drift report

Capture start time, impacted service, and environment.

## 2) Build a short timeline

1. Datadog events and monitor transitions
2. Related APM trace spikes or error spans
3. CBF pull dispatches and sink outcomes
4. Supabase `operation_track` records for the same window

## 3) Confirm control-plane health

- `cbf.pull.collisions` remains near zero
- `cbf.pull.sink.errors` does not spike
- `cbf.fleet.agents.healthy` is stable
- `cbf.fleet.cmd.dispatched` and `cbf.fleet.cmd.completed` stay aligned

## 4) Persist findings

- Store root cause hypothesis and verified evidence in memory-store
- Link relevant Notion page id and CBF dispatch id for follow-up sessions