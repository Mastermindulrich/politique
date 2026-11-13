# POLITIQUE

The political social network for Côte d'Ivoire: citizens and the people who represent them on the same public square. This repo holds the public landing page and the web app.

Built with Next.js 15 (App Router), React 19, Tailwind and Supabase (Postgres, Auth, Realtime, Storage), the same stack as [prototypex.org](https://prototypex.org). French first, English second.

## What is in the app

Social core: posts (500 characters, up to 4 images or videos, polls, quotes, replies, hashtags, mentions), likes, reposts, bookmarks, follows, blocks, mutes, a "Pour vous" feed and a following feed, search, trends, profiles, notifications in real time and direct messages.

Built for Ivorian politics:

- **Voting place at sign-up.** Every account registers the region, department and commune where the person votes. It is private (see below) and links the account to its mayor, MP, senators and regional council.
- **Mes élus.** The officials whose mandate covers where you vote, their open questions and upcoming office hours.
- **Interpellations.** Public questions to an official. Citizens back them, the official answers publicly, and the page keeps the answer rate. The official sees what share of the backers are their own constituents, rounded and only above 20 backers.
- **Promesses.** A promise tracker per official, with a source for every promise and every status change.
- **Permanences numériques.** Scheduled live question sessions held by an official.
- **Baromètre.** One national question a month, with results per commune of vote once 50 people there have voted.
- **Boîte à idées.** Proposals per commune that neighbours back and the town hall can mark as studied, adopted or declined.
- **Badges and labels.** Green for elected officials, grey for institutions, orange for media, granted after a document check. Moderators and verified media can attach context or fact-check labels to a post.
- **Low-data mode, WhatsApp sharing, light and dark themes.**

## Privacy of the voting place

The voting place lives in `private_profiles`, a table whose only row level security policies are "the owner reads and writes their own row". Nothing else reads it directly. Features that need it go through `security definer` functions that return aggregates behind thresholds (`my_officials`, `official_constituents_count`, `interpellation_constituent_share`, `barometer_results`). Moderators and officials cannot read it. `tests/schema.test.mjs` checks this as real database roles.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values to use the app
npm run dev                   # http://localhost:3000
```

Checks: `npm run lint`, `npm run type-check`, `npm run build`, `node tests/schema.test.mjs` (applies the schema to an in-process Postgres and runs smoke and access checks).

Without Supabase variables the landing page, rules and privacy pages work and the app pages show a "not connected" notice.

## Connect a Supabase project

1. Create a project (Paris, `eu-west-3`, is the closest region to Abidjan).
2. In the SQL editor, run `supabase/migrations/0001_schema.sql`, then `supabase/seed/ci_geo.sql`. Everything goes into a `politique` schema (storage buckets `politique-media` and `politique-documents`), so the project can be shared with another app.
   Then Settings → API → Exposed schemas: add `politique`.
   Sharing a project means sharing its auth users and email templates. Nothing is attached to `auth.users`: people become members through `politique.join_politique()`, which the app calls after sign-in, and deleting a POLITIQUE account removes only the POLITIQUE data. To move out later: `pg_dump --schema=politique`, restore into the new project, and copy the members' auth users.
3. Authentication → Emails: in the "Magic Link" and "Confirm signup" templates, show the code with `{{ .Token }}`. The app asks people to type that code. Links in the email also work and land on `/auth/confirm`.
4. Authentication → URL configuration: set the site URL and add `<site>/auth/confirm` to the redirect URLs. Set up custom SMTP (for example Resend) before opening sign-ups: the built-in sender is limited to a few emails an hour.
5. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in the host's environment.
6. Sign up, then make yourself admin once in the SQL editor:
   `update politique.profiles set is_admin = true, is_moderator = true where handle = 'your_handle';`
7. Open `/admin` to add officials to the directory, review badge requests and reports, and publish the monthly barometer.

## Where things are

- `app/page.tsx`, `app/en`, `lib/content.ts`: landing page and its copy. The feed mock-up on the hero uses made-up names and numbers.
- `app/(app)`: the signed-in app (feed, post, profile, explore, messages, Mes élus, directory, interpellations, barometer, idea box, settings, admin).
- `app/(auth)`, `app/bienvenue`, `app/auth/confirm`: log-in, sign-up with the voting-place step, and email links.
- `app/(legal)`: community rules and privacy policy. Have a lawyer review both before launch.
- `lib/actions.ts`, `lib/auth-actions.ts`, `lib/feed-actions.ts`: server actions. `lib/data`: read queries. `lib/i18n.ts`: interface copy in French and English.
- `lib/ci-geo.ts`: regions, departments and communes. After editing it, run `node scripts/gen-geo-sql.mjs` to regenerate the seed.
- `supabase/migrations/0001_schema.sql`: tables, triggers, functions, row level security, storage buckets.

## Hosting

Deployed on Vercel. Two ways to put it under prototypex.org:

- **Subdomain** `politique.prototypex.org` (recommended for an app with accounts): add the domain to the Vercel project and one CNAME at the DNS host. No change to the main site. Leave `NEXT_PUBLIC_BASE_PATH` empty.
- **Path** `prototypex.org/politique`: set `NEXT_PUBLIC_BASE_PATH=/politique` here and add a rewrite from `/politique/:path*` to this project in the prototype-x repo.
