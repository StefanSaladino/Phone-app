# Phase 9 installation — notifications and hidden-answer bets

Complete these steps on `feature/bets-and-notifications` after Phase 8 and migration `0008` are working.

## 1. Run migration 0009

Copy all of:

```text
supabase/migrations/0009_push_notifications.sql
```

into Supabase SQL Editor and run it once.

## 2. Run migration 0010

After `0009` succeeds, copy all of:

```text
supabase/migrations/0010_hidden_answer_bets.sql
```

into Supabase SQL Editor and run it once.

Migration `0010` depends on the Phase 9 notification queue created by `0009`, so do not reverse this order.

## 3. Generate the VAPID key pair

From the project root:

```powershell
npm run generate:vapid
```

Save both generated values securely. The private key must never be committed.

## 4. Configure the browser build

Add the public key to `.env.local`:

```env
VITE_VAPID_PUBLIC_KEY=GENERATED_PUBLIC_KEY
```

Add the same variable to the Netlify project environment for Deploy Previews and production.

## 5. Create Edge Function secrets

Create a high-entropy cron secret in PowerShell:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Add these secrets in Supabase Dashboard under Edge Functions secrets:

```text
VAPID_PUBLIC_KEY=<generated public key>
VAPID_PRIVATE_KEY=<generated private key>
VAPID_SUBJECT=mailto:stefan.saladino@gmail.com
CRON_SECRET=<generated cron secret>
```

Do not add them to Netlify except for `VITE_VAPID_PUBLIC_KEY`.

## 6. Deploy the worker

Using the Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-notifications --no-verify-jwt
```

The function itself still requires `x-cron-secret`; disabling gateway JWT verification does not make the worker unauthenticated.

## 7. Schedule the worker

Open:

```text
supabase/setup/phase9_notification_cron.sql.example
```

Replace the project URL and cron-secret placeholders, then run the resulting SQL once in Supabase SQL Editor.

## 8. Verify the code

```powershell
npm run typecheck
npm run lint
npm run build
```

## 9. Test notifications

On the hosted installed PWA:

1. Open Dashboard.
2. Tap **Enable notifications**.
3. Accept the device permission prompt.
4. Tap **Send a test**.
5. Wait for the next worker run.
6. Confirm tapping the notification opens Together.

## 10. Test a hidden-answer bet

1. As the creator, choose **Hidden answer**.
2. Ask `What will you order for dinner?`.
3. Enter `Filet mignon` as the private prediction.
4. As the partner, verify the prediction does not appear before acceptance.
5. Accept the wager.
6. Enter the actual order.
7. Confirm both answers appear only after submission.
8. Confirm the suggested winner can still be disputed.
9. Complete the existing coin-and-wheel settlement flow.

Use browser Network tools before submission to confirm the invited partner receives `secret_answer: null`.

## Production note

Push subscriptions are tied to the exact site origin. A Deploy Preview subscription does not transfer to the production Netlify URL. Both people must enable notifications again after the final production merge.
