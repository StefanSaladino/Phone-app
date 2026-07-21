# send-notifications Edge Function

Claims due rows from `notification_jobs`, sends Web Push messages to every active device for the recipient, records delivery health, retries transient failures, and disables expired endpoints.

Required secrets:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
CRON_SECRET
```

Supabase automatically provides:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Deploy without gateway JWT verification because the cron request is authenticated by the separate `x-cron-secret` header:

```bash
npx supabase functions deploy send-notifications --no-verify-jwt
```

Never expose `VAPID_PRIVATE_KEY`, `CRON_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in the browser or Netlify environment.
