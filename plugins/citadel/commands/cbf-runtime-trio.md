# CBF Runtime Trio Command Playbook

Use this command playbook when running CBF planning/build loops with the three runtime modules:

1. `cml_blueprints.py`
2. `citadel_reflex_engine.py`
3. `cbx` CKET builder

## Inputs

- `blockers`: list of active blockers
- `intent_goals`: list of goal payloads
- `health_score`: numeric health score (0-100)
- `target_domain`: domain id for keyword/reflex expansion
- `blueprint_id_or_path`: blueprint source for CKET build

## Sequence

1. Build planner context with `run_blueprint_planner_context(...)`.
2. Pull domain keywords with `get_domain_keywords(target_domain)`.
3. Trigger growth cycle (`run_nemesis_growth_cycle`) when routing quality is weak.
4. Execute `cbx build`.
5. Execute `cbx iterate` for unresolved stage gaps.
6. Execute `cbx validate` and `cbx manifest`.
7. Persist outcomes to memory-store.

## Required outputs

- Selected blueprint names/files
- Domain keyword set
- CKET build/iterate status
- Validation pass/fail summary
- Dispatch id / run correlation id