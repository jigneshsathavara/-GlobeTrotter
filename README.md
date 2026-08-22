# GlobeTrotter

GlobeTrotter is a complete personalized travel-planning product for multi-city journeys. It combines trip creation, itinerary building, discovery, calendar planning, automatic budget tracking, sharing, account preferences, and admin insights in one responsive interface.
LINK :- https://globetrotter-journeys.ravalviraj680.chatgpt.site
## Included product areas

1. Login screen with username/email, password, traveler avatar, and demo access
2. Registration screen with photo, first/last name, username, email, phone, city, country, password, and additional information
3. Main landing page with a hero banner, global search/group/filter/sort controls, regional selections, and previous trips
4. Dedicated create-trip page with trip dates, first place, place date range, budget, and suggestions
5. Section-based itinerary builder with date ranges, section budgets, activities, ordering, and “Add another section”
6. Trip listing grouped into ongoing, upcoming, and completed journeys
7. User profile with editable details, preplanned trips, previous trips, saved places, and account controls
8. City and activity search pages with grouped, filtered, sorted results and add-to-trip actions
9. Day-based itinerary view connecting physical activities to expenses, plus a full budget view
10. Searchable community feed and public, read-only itinerary sharing
11. Calendar view with trip selection, search controls, event cells, timeline, and quick editing
12. Admin panel with Manage Users, Popular Cities, Popular Activities, and User Trends & Analytics modes

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
- Relational database with a Drizzle schema and versioned migrations
- Route-handler backend with prepared SQL statements and ownership checks
- PBKDF2-SHA256 password hashing with a unique salt
- Signed, HttpOnly session cookie with one auth guard for protected API actions
- CSS-rendered budget charts to keep the application lightweight
- Production-ready build and deployment configuration

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

video link :- https://drive.google.com/file/d/1fXwFcd1OgGjMD8rIBy0rpCrAhUALd0to/view?usp=drive_link
