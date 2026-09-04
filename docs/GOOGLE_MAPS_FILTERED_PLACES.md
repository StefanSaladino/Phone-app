# Filtered Google Maps for Places

## Status

This feature is implemented as a local/testable overlay and is intentionally not pushed or deployed automatically.

The Places page now offers a **View X on map** action whenever the current filtered result set contains at least one place. The modal receives the page's existing `visiblePlaces` array directly, so category, location, status, favourites, search, and combined filters all stay in one source of truth.

## Google Cloud setup

Create a browser API key in the Google Cloud project used for Together and configure the Google Maps Platform services required by the current Maps JavaScript Place class.

Google's current documentation calls for:

- Maps JavaScript API
- Places API
- Places API (New)

Use HTTP referrer restrictions on the browser key. For local development, allow the Vite origin you actually use, normally:

```text
http://localhost:5173/*
```

For production, allow only the real Together production origin(s).

Create a Map ID for the production map. Advanced Markers require a Map ID.

## Environment variables

Add these browser-safe values to `.env.local` for local testing and to the Netlify environment only when you are ready to deploy:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_BROWSER_RESTRICTED_API_KEY
VITE_GOOGLE_MAPS_MAP_ID=YOUR_MAP_ID
```

Do not add any Supabase service-role credential or other private server credential to `VITE_*` variables.

## Loading behavior

Google Maps is not loaded during a normal `/places` visit.

The sequence is:

```text
open /places
  ↓
apply normal filters/search
  ↓
visiblePlaces
  ↓
press View X on map
  ↓
load Maps JavaScript API
  ↓
load maps / marker / places / core libraries
  ↓
resolve only visiblePlaces
  ↓
render Advanced Markers
```

Closing the sheet removes the markers and leaves the normal Places page in place.

## Place resolution

Together does not attempt to parse latitude/longitude from arbitrary or shortened Google Maps share links.

For each saved place:

1. Check for a cached Google Place ID for that Together place record.
2. If cached, fetch current fields for that Place ID.
3. Otherwise perform Places Text Search using only the saved place name, address, and location.
4. Rank the returned candidates and require a confident name/address/location match.
5. Cache only the Google Place ID when a confident match is found.
6. Leave ambiguous or failed matches off the map.

Unmatched places remain available beneath the map with an **Open in Google Maps** link using the app's existing Maps-link behavior.

## Local Place-ID cache

The browser cache key is:

```text
together:google-place-id:<together-place-id>
```

The cached value contains the Google Place ID plus a fingerprint of the saved identifying fields:

- name
- address
- location
- maps URL

If any of those fields change, the cached Place ID is invalidated automatically and the next map opening resolves the place again.

Latitude/longitude is not stored in localStorage or Supabase.

## Privacy behavior

The Google lookup receives only the fields required to resolve a location:

- saved place name
- saved address when present
- saved location when present

Together does not send private notes, couple membership data, bets, wheel contents, messages, or other unrelated application data to Google Maps.


## Current user location

The map includes an explicit **Show my location** control. Together does not request location permission when the Places page or map first opens. Permission is requested only after the user taps that control.

The implementation uses the browser's native Geolocation API (`navigator.geolocation.getCurrentPosition`) and does **not** require the paid Google Geolocation API.

When permission is granted:

- a distinct current-location marker is added to the map
- map bounds are recomputed to include both the filtered saved places and the user's current location
- the user can tap **Update my location** to refresh the one-time reading
- coordinates are kept only in component memory for the open map session
- current coordinates are not written to Supabase or localStorage

Location access requires HTTPS in production (localhost is allowed for development). The production Netlify `Permissions-Policy` must allow same-origin geolocation, so this feature changes it from `geolocation=()` to `geolocation=(self)`.

If permission is denied or a position cannot be determined, the saved-place map continues to work and the location control shows an understandable error.

## Modal/mobile behavior

The map stays on `/places` and opens as a large sheet.

It supports:

- iPhone safe areas
- background body-scroll lock
- touch map gestures
- X close button
- Escape key on desktop
- backdrop close
- one-marker fixed zoom
- multi-marker automatic bounds fitting
- marker info windows
- fallback links for unmatched places
- missing/broken API configuration errors without crashing `/places`
- user-initiated current-location permission
- current-location marker and refresh action
- graceful denied/unavailable location handling

## Acceptance test checklist

Before publishing, verify at minimum:

### Filters

- no filters
- each category
- location
- favourites
- want to go
- visited
- search
- combined filters
- zero-result state

For every case, the map action count must match the number of visible place cards.

### Place data

Test saved places with:

- a full Google Maps URL
- a shortened `maps.app.goo.gl` URL
- address but no Maps URL
- location but weak/incomplete address data
- ambiguous names

Ambiguous matches should remain unmapped rather than being guessed.

### Mobile

On actual iPhone Safari / installed PWA if practical:

- sheet fits the viewport
- no horizontal overflow
- page behind the sheet cannot scroll
- map accepts touch gestures
- close button remains reachable
- bottom safe area is respected
- Show my location triggers the browser/iOS permission flow
- granting permission adds the current-location marker
- denying permission does not break the saved-place map
- Update my location refreshes the marker

### Validation gate

Run from the repository root:

```powershell
npm run typecheck
npm run lint
npm run build
```

All three must pass before commit/push.
