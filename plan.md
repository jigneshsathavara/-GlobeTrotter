# GlobeTrotter

GlobeTrotter is a complete personalized travel-planning product for multi-city journeys. It combines trip creation, itinerary building, discovery, calendar planning, automatic budget tracking, sharing, account preferences, and admin insights in one responsive interface.

## Included product areas

1. Email/password sign up and sign in with a signed, seven-day session token
2. Personalized dashboard with upcoming trips, ideas, and budget highlights
3. Create-trip flow with dates, description, cover URL, and budget limit
4. My Trips list with view, edit, and delete actions
5. Itinerary Builder with stops, activities, costs, notes, and up/down ordering
6. Structured Itinerary View with list and calendar modes
7. Automatic budget breakdown for transport, stays, activities, and meals
8. Searchable, region-filtered catalog of 20 cities
9. Activity discovery with category, cost, duration, and add-to-stop controls
10. Calendar and route timeline with quick editing
11. Public, read-only itinerary links plus a community inspiration surface
12. Profile settings for name, email, language, and saved destinations
13. Admin analytics for users, trips, activities, destinations, and engagement

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Demo account:

- Email: `demo@globetrotter.app`
- Password: `wander123`

The local database is created and seeded automatically on the first API request.

## Architecture

- React 19 with Vinext/Vite and Tailwind CSS
- Cloudflare D1 relational database with Drizzle schema and migrations
- Route-handler backend with prepared SQL statements and ownership checks
- PBKDF2-SHA256 password hashing with a unique salt
- Signed, HttpOnly session cookie with one auth guard for protected API actions
- CSS-rendered budget charts to keep the application lightweight
- Sites-ready build and hosting configuration

The six-table relational model mirrors the build plan: `users`, `trips`, `stops`, `activities`, `expenses`, and `cities_catalog`. The initial migration is in `drizzle/`.

## Useful commands

```bash
pnpm db:generate
pnpm lint
pnpm build
```

Set `NEXT_PUBLIC_SITE_URL` and a strong `JWT_SECRET` for production. See `.env.example`.

## Core demo path

1. Create an account or sign in with the demo account.
2. Create a trip with a date range and budget.
3. Open **My trips**, edit the plan, and add two stops.
4. Add activities with costs to either stop.
5. Preview the structured itinerary.
6. Open **Budget** and confirm the itemized total and category chart.
7. Refresh the page and sign in again to verify persistence.
8. Enable sharing under **Community**, then copy the public itinerary link.
