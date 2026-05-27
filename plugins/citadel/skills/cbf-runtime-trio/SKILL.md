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

Key APIs to call:

- `refresh_blueprints_from_notion(timeout=90)`
- `select_blueprints(blockers, intent_goals, health_score, max_blueprints=4)`
- `format_blueprints_for_planner(blueprints)`
- `run_blueprint_planner_context(blockers, intent_goals, health_score, refresh=False)`

### 2) `citadel_reflex_engine.py`

- Loads enum/reflex maps and acquired suggestions.
- Produces domain keywords and professor/reflex chains.
- Supports growth cycles (including stagger-driven acquisitions) for improved routing.

Key APIs to call:

- `get_reflex_engine()`
- `get_domain_keywords(domain_id)`
- `get_professor_chain(enum_key)`
- `run_nemesis_growth_cycle()`
- `grow_via_stagger(category, description="")`

Quality/routing helpers:

- `get_caps_tier(cosine_similarity)`
- `is_drift_candidate(cosine_similarity)`

### 3) `cbx` CKET builder

- Parses blueprint sections into CKET stages.
- Writes stage files/tasks and supports iterative gap filling.
- Can trigger validation/manifests after stage generation.

Primary command surface:

- `cbx build <blueprint_id_or_path>`
- `cbx iterate`
- `cbx status`
- `cbx validate`
- `cbx manifest`
- `cbx generate <stage>`

## Recommended execution order

1. Build planner context from blueprint cache (`run_blueprint_planner_context`).
2. Enrich target domain routing (`run_nemesis_growth_cycle` / `get_domain_keywords`).
3. Materialize stage outputs and iterate missing artifacts (`cbx build` then `cbx iterate`).

## Suggested integrated loop

1. **Context load**
   - Refresh cache only if stale.
   - Select top relevant blueprints and inject into planner prompt.
2. **Reflex expansion**
   - Pull domain keywords and professor chains.
   - Run growth cycle for weak domains or low-health routes.
3. **Build execution**
   - Build from selected blueprint.
   - Iterate unresolved CKET gaps.
4. **Post-build validation**
   - Validate generated artifacts.
   - Regenerate manifest when stage output changed.
5. **Persistence**
   - Save dispatch ids, selected blueprint names, growth outputs, and validation outcomes into memory-store.

## Example orchestration pseudocode

```python
context = run_blueprint_planner_context(
    blockers=blockers,
    intent_goals=intent_goals,
    health_score=health_score,
    refresh=needs_refresh,
)

engine = get_reflex_engine()
domain_kws = engine.get_domain_keywords(target_domain)
growth = engine.run_nemesis_growth_cycle()

# build + iterate via cbx shell/runner layer
run("cbx build", blueprint_id)
run("cbx iterate")
run("cbx validate")
run("cbx manifest")
```

## Guardrails

- Do not run Notion refresh on every cycle unless cache staleness requires it.
- Persist key outcomes (dispatch ids, selected blueprints, growth outputs) into memory-store.
- Correlate `cbf.pull.*` and `cbf.fleet.*` metrics during each iteration for drift detection.
- Prefer deterministic stage generation first; use LLM-generated stage code only for explicit stage gaps.