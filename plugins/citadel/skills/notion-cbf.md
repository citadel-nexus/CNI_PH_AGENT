---
name: notion-cbf
description: Work with Notion pages and the CBF pull pipeline
alwaysApply: false
---

# Notion / CBF Integration

CBF uses Notion as source of truth for code and configuration artifacts.

## CBF pull pipeline pattern

1. Source pages are titled `<tool> v<version> - <description>`
2. File sections use headings: `## File N - <path>`
3. Code blocks under each heading contain file contents
4. `cbf_bootstrap.py` resolves pages, pulls blocks, and writes files

## Key conventions

- Dunder filenames (`__init__.py`, `__main__.py`) should be wrapped in backticks in headings
- Every pull gets a dispatch ID: `CBF-PULL-YYYYMMDD-HHMMSS`
- Pull sinks include Linear, Datadog, Supabase, and PostHog
- `workspace.env` stores integration credentials such as `NOTION_TOKEN` and `DD_API_KEY`

## Practical usage

- Search and fetch relevant Notion pages before patching local files
- Use CBF pull summaries (written/changed/collisions) to validate sync integrity