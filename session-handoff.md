# Session handoff — 2026-09-25 (local Codex research)

## Latest state — read before the older handoff below

The owner asked local Codex to conduct the proposed author research independently. Completed a bounded experiment in `docs/process/2026-09-25-author-study/`: two authors, identical r2-B system + one supplied premise, one call each, no retries, plus two safety calls. GPT-5 produced 472 words, GPT-4.1 produced 327. Both safety pass; GPT-4.1 fails length. Codex rejected both as finished stories; GPT-5 is usable material for substantial editing. Four traces retrieved with HTTP 200 and GENERATION observations; total LangFuse API cost $0.05205025.

`report.md` gives the finding and limits: the supplied premise itself over-explained the lesson and omitted the concrete ending of the internal play. No proof that planning or either model solves the product. `edited-candidate.md` is a **substantial rewrite by Codex in the chat**, 379 words; not an unchanged API response, not an automated editor, not owner-approved, no separate model safety run on the edited version. Owner has been given this single candidate to read. No further generation scheduled or authorized by this handoff. Production prompts/code unchanged; STO-15 still in progress, PR #410 draft and unmerged.

Next: read the owner's feedback and this research record before deciding another experiment. Do not treat the rewrite as a gold until explicitly accepted. The older r2 blind review and external research are already posted in STO-15 (comments `b4256898-4470-41b4-a539-fdfca7d012e8` and `6559248f-a61c-4ce9-80b2-233884042432`); the old instruction below to wait for Codex's blind read is obsolete. The r2 journals still need their originally planned archival step; not silently folded into this new experiment.

Environment: Docker StoryGrow was started for tracing and stopped afterwards, volumes retained. Another project's PostgreSQL/Redis occupies 5432/6379; a temporary override at `/Users/mac/.codex/research/storygrow/2026-09-25-compose-research.yml` removes only host publication of StoryGrow's two conflicting ports. It does not change internal LangFuse connectivity. Do not stop the other project's containers or assume the regular backend DB connection reaches StoryGrow while those ports are occupied. Final smoke result is recorded in progress.md.

---

## Previous Claude handoff (historical details retained)

**Ticket:** STO-15 — first whole tale 5–6/virtue, text-only harness + owner reading (stage 1 of ADR-0008). **Branch:** `issue/sto-15-first-whole-tale` (pushed, head after this commit). **Draft PR:** #410 — do NOT merge; local Codex code review not finished.

## State

- Harness `eval:whole-story` built, tested (17 unit tests), `./init.sh` green. Prompts v2 in `backend/src/ai/prompts/{whole-story,story-safety,judge-v2}.prompt.ts`; author variant `B` = 5–6 profile without the attempt-count sentence, `A` byte-identical to round 1 (verified by re-running r1 from its journal, zero new calls).
- **r1** (3 goals): all three rejected by the owner (titles above all). Frozen in `docs/process/2026-09-24-whole-story-stage1/r1/` with README.
- **r2** (Доброта, 2×A + 2×B, 4 calls, $0.20, 12/12 traces): blind package only is committed (`docs/process/.../r2/reading.{html,json}`). **Key, results, metrics, calls, manifest are in `backend/output/whole-story/2026-09-24-r2/` (gitignored) and must be copied into `docs/process/.../r2/` AFTER local Codex posts its blind reading in STO-15.** My non-blind editorial notes: `/private/tmp/claude-501/-Users-mac-Projects-storygrow/6a2a55ad-42fe-41e2-96f6-cb5f5aeb96af/scratchpad/r2-editorial-notes-nonblind.md` — scratchpad may be gone in a new session; the gist is in the last chat turn: B moved away from the attempt template 2/2, A kept it 2/2; «Алиса и синий мост» (B) is the only one of seven tales that opens with an event, not the hero's age; «Рейс для Глаши» (B) has a thin conflict.

## Next

1. Read Codex's blind-reading comment on STO-15 (reply thread under its protocol comment). Then: copy the rest of r2 into `docs/process/.../r2/`, post my notes, update README r2 section with the outcome, commit.
2. Agree the next single variable with Codex (candidates: the hero line causing «Алисе шесть лет» openings; the safety block pulling a domestic setting). One round, ≤ 4 calls, new output dir. No automatic rounds.
3. Before any live run: `docker compose up -d` (LangFuse must answer 200 on `http://localhost:3030/api/public/health`); Docker was stopped at session end, volumes kept.
4. STO-16 (`.codex/` in `.gitignore`) is a one-line chore, untouched.

## Rules in force

Codex coordinates locally: no `@codex` mentions, no cloud runs; end replies with «Готово к повторному ревью локальным Codex» only when asking for review. Owner wants Codex's proposals analysed, not accepted as given — say where you agree and where not.
