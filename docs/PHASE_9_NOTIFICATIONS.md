# Phase 9 — PWA push notifications

Phase 9 adds standards-based Web Push without changing surprise-note behaviour.

## Supported alerts

- Planned-date reminders
- New bet invitations
- Bet acceptance, rejection, and cancellation
- Settlement proposals and disputes
- Confirmed draws and wheel-ready results
- Generic wheel-reveal updates
- Completion requests and confirmations
- Waived outcomes
- User-triggered test notifications

## Deliberate exclusions

Surprise notes never enter `notification_jobs`. The queue helper rejects `surprise_note`, and no trigger exists on the `notes` table.

Hidden prize and punishment text is also excluded from push payloads. A reveal notification tells the recipient to open Together without putting the selected result on the Lock Screen.

## Architecture

```text
React PWA
  -> PushManager subscription
  -> push_subscriptions

Date or bet event
  -> PostgreSQL trigger
  -> notification_jobs

Supabase Cron
  -> send-notifications Edge Function
  -> browser push service
  -> service-worker.js
  -> visible device notification
```

## Security

- Each user can read only their own preferences and subscriptions.
- Subscription writes use authenticated security-definer RPCs.
- Browser clients have no access to queued jobs.
- The worker uses the service-role key only inside Supabase Edge Functions.
- Cron calls require a high-entropy `x-cron-secret` value.
- Expired endpoints are automatically disabled after HTTP 404 or 410.
