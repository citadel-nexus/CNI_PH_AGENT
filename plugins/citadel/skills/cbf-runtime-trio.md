---
name: cbf-runtime-trio
description: Coordinate blueprint selection, reflex growth, and CKET build stages in CBF loops
alwaysApply: false
---

# CBF Runtime Trio

Apply this orchestration pattern when CBF needs full planning + growth + build execution:

1. `cml_blueprints.py`
2. `citadel_reflex_engine.py`
3. `cbx` CKET builder

## Responsibilities

### 1) `cml_blueprints.py`

- Pulls from local `notion_blueprints/vcc_latest/` cache.
- Optionally refreshes cache via `NEMESIS.py vcc --refresh`.
- Selects and formats blueprint snippets for planner prompt injection.

### 2) `citadel_reflex_engine.py`

- Loads enum/reflex maps and acquired suggestions.
- Produces domain keywords and professor/reflex chains.
- Supports growth cycles (including stagger-driven acquisitions) for improved routing.

### 3) `cbx` CKET builder

- Parses blueprint sections into CKET stages.
- Writes stage files/tasks and supports iterative gap filling.
- Can trigger validation/manifests after stage generation.

## Recommended execution order

1. Build planner context from blueprint cache (`run_blueprint_planner_context`).
2. Enrich target domain routing (`run_nemesis_growth_cycle` / `get_domain_keywords`).
3. Materialize stage outputs and iterate missing artifacts (`cbx build` then `cbx iterate`).

## Guardrails

- Do not run Notion refresh on every cycle unless cache staleness requires it.
- Persist key outcomes (dispatch ids, selected blueprints, growth outputs) into memory-store.
- Correlate `cbf.pull.*` and `cbf.fleet.*` metrics during each iteration for drift detection.