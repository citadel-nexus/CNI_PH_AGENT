---
name: supabase-analytics
description: Query Supabase operation tracking and analytics data
alwaysApply: false
---

# Supabase Analytics

Citadel platform operational activity is tracked in Supabase via `operation_track`.

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
- `created_at`

## Common query patterns

- Recent operations: `SELECT * FROM operation_track ORDER BY created_at DESC LIMIT 20`
- Failed operations: `SELECT * FROM operation_track WHERE outcome = 'error' ORDER BY created_at DESC`
- Tool usage counts: `SELECT tool, count(*) FROM operation_track GROUP BY tool ORDER BY count(*) DESC`