# POLITIQUE — pre-launch website

Marketing site and waitlist for POLITIQUE, the political social network for Côte d'Ivoire. French at `/`, English at `/en`.

Built with Next.js 15 (App Router), React 19 and Tailwind, the same stack as [prototypex.org](https://prototypex.org). The product itself (web app, mobile app, API) lives elsewhere; this repo is only the public site.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev                   # http://localhost:3000
```

Checks: `npm run lint`, `npm run type-check`, `npm run build`.

## Content

All copy lives in `lib/content.ts`, one object per language. Change text there, not in the components. The feed mock-up on the hero (`app/components/mock-feed.tsx`) uses made-up names and numbers.

## Waitlist

`POST /api/waitlist` takes `{ email, role, lang }`. With `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` set, each sign-up becomes a contact in that Resend audience (role and language are stored in the contact's first name as `role/lang` until contact properties are set up). Without them, sign-ups are only logged, so set both before sharing the site. `WAITLIST_NOTIFY_TO` plus `WAITLIST_FROM` (a verified Resend sender) sends you an email per sign-up.

## Hosting

Deployed on Vercel. Two ways to put it under prototypex.org:

- **Subdomain** `politique.prototypex.org`: add the domain to the Vercel project and a CNAME at the DNS host. No change to the main site. Leave `NEXT_PUBLIC_BASE_PATH` empty.
- **Path** `prototypex.org/politique`: set `NEXT_PUBLIC_BASE_PATH=/politique` here, add a custom domain to this project, and add a rewrite from `/politique/:path*` to that domain in the prototype-x repo.
