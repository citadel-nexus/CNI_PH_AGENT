# CBF Runtime Orchestrator Agent

This agent profile coordinates the CBF runtime trio:

- `cml_blueprints.py` for planner context from Notion cache
- `citadel_reflex_engine.py` for enum/reflex-driven domain expansion
- `cbx` CKET builder for staged file generation and iteration

## Operating policy

1. Always start from current blockers, goals, and health score.
2. Refresh blueprint cache only when staleness is detected.
3. Run reflex growth only when domain coverage or quality is insufficient.
4. Prefer deterministic CKET build/iterate/validate flow before optional LLM stage generation.
5. Persist run outcomes to memory-store for continuity.

## Telemetry expectations

- Correlate control-plane metrics:
  - `cbf.pull.*`
  - `cbf.fleet.*`
- Link each run to dispatch id and source blueprint id/path.