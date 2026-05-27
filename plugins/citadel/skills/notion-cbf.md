---
name: notion-cbf
description: Interact with Notion pages and the CBF (Citadel Build Framework) pull pipeline
alwaysApply: false
---

# Notion / CBF Integration

CBF uses Notion pages as source-of-truth content for file generation and pull operations.

## CBF pull conventions

1. Page title format: `<tool> v<version> — <description>`
2. File declaration headings: `## File N — <path>`
3. File content in code blocks under each heading
4. `cbf_bootstrap.py` resolves title/page id, pulls blocks, and writes files

## Important details

- Dunder filenames (`__init__.py`, `__main__.py`) should be wrapped in backticks in headings.
- Every pull emits a dispatch id: `CBF-PULL-YYYYMMDD-HHMMSS`.
- Pull sinks include Linear, Datadog, Supabase, and PostHog.
- `workspace.env` is the common source for `NOTION_TOKEN`, `DD_API_KEY`, and related keys.

## Notion MCP usage

- Use search operations to locate source pages by title.
- Use page read operations to inspect content before editing.
- Use memory-store to persist findings and pull outcomes across sessions.

## CBF runtime trio (recommended in sequence)

Use these three components together in CBF workflows:

1. `cml_blueprints.py`
   - Refresh/select relevant Notion blueprint cache context for planning.
2. `citadel_reflex_engine.py`
   - Expand domain keywords/professor chains and run reflex growth support.
3. `cbx` CKET builder flow
   - Parse blueprint output into staged filesystem artifacts and iterate gaps.

Recommended order for each cycle:

1. planner context (`cml_blueprints`)
2. reflex/domain expansion (`citadel_reflex_engine`)
3. staged file materialization + validation (`cbx`)