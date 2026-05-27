---
name: supabase-analytics
description: Query Supabase for operation tracking and analytics data
alwaysApply: false
---

# Supabase Analytics

Use Supabase to inspect operation tracking for automation and telemetry pipelines.

## operation_track schema (v2)

- `seat`
- `guild`
- `domain`
- `operation`
- `outcome`
- `tool`
- `args_preview`
- `duration_ms`
- `fired`
- `async`
- `metadata` (jsonb)
- `mem_ids` (text[])
- `fingerprint`
- `created_at` (timestamptz, auto)

## Common queries

- Recent operations:
  - `SELECT * FROM operation_track ORDER BY created_at DESC LIMIT 20`
- Failed operations:
  - `SELECT * FROM operation_track WHERE outcome = 'error' ORDER BY created_at DESC`
- Operations by tool:
  - `SELECT tool, count(*) FROM operation_track GROUP BY tool ORDER BY count(*) DESC`