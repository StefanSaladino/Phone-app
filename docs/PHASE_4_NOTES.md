# Phase 4 — Saved Places

Phase 4 turns the Places route into a complete shared place library.

## Included

- Create, edit, and delete places
- Food, coffee, drinks, dessert, and recreation categories
- Search by name, address, notes, or category
- Category, favourite, visited, and want-to-go filters
- Favourite and visited quick actions
- Optional address, website, Google Maps share link, and private notes
- Automatic Google Maps search link when no share link is saved
- Live dashboard place totals after create/delete
- Mobile-first bottom-sheet form and confirmation dialog
- Separate types, services, link helpers, components, page state, and styling

## Google Maps behaviour

A saved Google Maps share link is used when present. If there is no saved share
link, the app opens a normal Google Maps search built from the place name and
address. This requires no Google Maps API key, embedded map, or paid account.

## Database

No migration is required. The original `places` table already includes every
field used in this phase, and the existing Row Level Security policies grant the
two linked couple members access to their shared rows.
