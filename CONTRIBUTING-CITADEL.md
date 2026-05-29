# Contributing to CNI_PH_AGENT (Citadel Nexus fork)

This is Citadel Nexus's fork of [PostHog/code](https://github.com/PostHog/code) — the
observation / IDE stack inside the Citadel autonomous-development platform. Upstream
contribution rules live in [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md);
**this file documents the Citadel-specific contribution model layered on top.**

> The era of self-driving development is here. Most changes in this fork are produced by the
> CBF agent loop — humans and agents contribute through the same gates.

## Two streams of change

1. **Upstream sync** — we periodically merge `PostHog/code:main` to stay current. The fork is
   currently *diverged*; sync via a dedicated merge branch (`citadel/upstream-sync-YYYYMMDD`),
   resolve conflicts, and PR — never force-push `main`.
2. **Citadel features** — synced from our primary dev repo (GitLab `guilds/CNWB`) via the
   `Sync all Citadel features from origin/main` flow.

## How Citadel develops this (self-driving development)

Changes here are produced by the **CBF (Citadel Bridge Framework)** agent loop, not only humans:

- **CBF reflexes** (`tools/cbf/reflex/`) — a single command fans out to memory + NATS + Notion +
  runbook + telemetry (PostHog/Datadog) and returns one JSON envelope. Actions: `audit`, `infer`,
  `recall`, `cscc-repair`, `bench`, `faiss-recover`.
- **CSCC pipeline** — tickets flow CSCC ↔ Linear ↔ GitLab; a 5-stage orchestrator
  (context → autoheal → debug → propose → record) proposes fixes, with auto-runbooks archived to
  Supabase `citadel-archive`.
- **Memory system** — a ~91k-vector store (NVIDIA NIM `nv-embedqa-e5-v5`, 1024-dim) with a
  Cloudflare Workers AI `bge-large` ensemble index; every operation stores an IOO triple
  (intent / objective / outcome) and is recalled to ground agent decisions.
- **Observation stack** — PostHog + Datadog capture every reflex and build action.
- **Inference stack** — NVIDIA NIM + Megamind (Qwen) power classification, synthesis, and the
  iterative build loop.

## Contribution flow (humans + agents)

1. Branch from `main` (`feat/...`, `fix/...`, `citadel/...`).
2. Make the change. Agents store an IOO triple to the memory system for traceability.
3. Validate (inherits upstream — Node 22+, pnpm 10.23+):
   ```bash
   pnpm install && cp .env.example .env
   pnpm typecheck && pnpm lint && pnpm test
   ```
4. Open a PR. The `pr-approval-agent` (`tools/pr-approval-agent`) reviews alongside human reviewers.
5. On merge, CBF records the operation + generates a runbook in `citadel-archive`.

## Guardrails

- One logical change per PR; resolve conflicts before requesting review.
- Follow [AGENTS.md](./AGENTS.md) architecture rules (renderer stays UI-only; main process owns
  business logic, host-agnostic).
- Secrets never live in source — they're in Supabase Vault + workspace env, pulled at runtime.
- Destructive/infra changes require an operator-approved CBF reflex.

---
*Maintained by the Citadel Nexus CBF loop. Questions: open an issue or ping the operator.*
