# Google Cloud setup for StoryGrow

Single reference for the Google project, billing, keys and OAuth redirect URIs so
this never gets lost again. **No secret values live in this file** — only ids,
domains, redirect URIs and which env var holds what.

## Project & billing

| Item | Value |
|---|---|
| Organization | `yes-code.dev` |
| **Cloud project** | `StoryGrow` — id **`storygrow-507614`** |
| **Billing account** | **StoryGrow Billing Account** (Tier 1 · Prepay) |
| Enabled API | **Generative Language API** (`generativelanguage.googleapis.com`) |

Image/text generation (Gemini) is **prepaid** — it only works while the StoryGrow
Billing Account holds a positive balance. Check it: Google Cloud → Billing →
select *StoryGrow Billing Account* → **Credits** / overview.

> Deprecated, no longer used: projects `metal-dimension-489813-s4`
> (*My First Project*) and `gen-lang-client-0313899978` (*Default Gemini Project*).
> Everything now lives under `storygrow-507614`.

## Keys → env vars

Create these in **project StoryGrow**. Values go in `backend/.env` locally and in
**Railway** (per service) for production — never commit the actual values.

| Env var | What it is | Where it comes from |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key (image + text generation) | AI Studio → API Keys → create in project *StoryGrow*, or Cloud Console → APIs & Services → Credentials → API key |
| `GOOGLE_CLIENT_ID` | Google OAuth "Sign in with Google" client id | Cloud Console → Credentials → OAuth client ID (Web application) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | same OAuth client |
| `GOOGLE_CALLBACK_URL` | OAuth callback route on the **backend** | see below |

The Gemini key (`GOOGLE_GENERATIVE_AI_API_KEY`) and the OAuth client
(`GOOGLE_CLIENT_*`) are **different credentials** — deleting/creating one does not
affect the other. The image experiments (`eval:images`) need only the Gemini key;
OAuth is only for user login.

## OAuth Web client

Backend route: `GET /auth/google/callback` (`auth.controller.ts`).

**Authorized redirect URIs** (both):
- `http://localhost:3001/auth/google/callback` (local)
- `https://storygrow-production.up.railway.app/auth/google/callback` (prod)

**Authorized JavaScript origins** (the console requires at least one; base origin,
no path):
- `http://localhost:3000` (frontend local)
- `https://storygrow-web-production.up.railway.app` (frontend prod)

`GOOGLE_CALLBACK_URL` value:
- local: `http://localhost:3001/auth/google/callback`
- prod (Railway): `https://storygrow-production.up.railway.app/auth/google/callback`

## Railway services & domains

| Service | Role | Public domain |
|---|---|---|
| `storygrow-web` | frontend (Next.js) | `storygrow-web-production.up.railway.app` → `FRONTEND_URL` |
| `storygrow-api` | backend (NestJS) | `storygrow-production.up.railway.app` → OAuth callback host |
| `Postgres`, `Redis` | data / queue | internal |

Find a service's domain: Railway → click the service → **Settings → Networking →
Public Networking**. The OAuth callback host is the **api** service, not the web one.

## When rotating or recreating any of these

1. Create/rotate in **project `storygrow-507614`** (keep it all in one project).
2. Update the value in `backend/.env` (local) **and** in Railway env for the right
   service (prod).
3. For a new OAuth client, re-add both redirect URIs and both JS origins above.
4. Never paste key values into chat, commits, or this file.
