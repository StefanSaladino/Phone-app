import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

interface NotificationJob {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  route: string;
  attempts: number;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  failure_count: number;
}

interface WebPushError extends Error {
  statusCode?: number;
  body?: string;
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required Edge Function secret: ${name}`);
  }

  return value;
}

function safeDeliveryError(error: unknown): {
  message: string;
  statusCode: number | null;
} {
  if (error instanceof Error) {
    const pushError = error as WebPushError;

    return {
      message: pushError.message.slice(0, 450),
      statusCode:
        typeof pushError.statusCode === 'number' ? pushError.statusCode : null,
    };
  }

  return {
    message: 'Unknown Web Push delivery failure.',
    statusCode: null,
  };
}

/**
 * Sends queued Web Push jobs claimed atomically from Postgres.
 *
 * The function is deployed without gateway JWT verification because pg_cron
 * calls it directly. A separate high-entropy CRON_SECRET is required on every
 * request, and all database access uses the server-only service-role key.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    try {
      const cronSecret = requiredEnvironmentValue('CRON_SECRET');
      const providedSecret = request.headers.get('x-cron-secret');

      if (!providedSecret || providedSecret !== cronSecret) {
        return jsonResponse({ error: 'Unauthorized.' }, 401);
      }

      const supabaseUrl = requiredEnvironmentValue('SUPABASE_URL');
      const serviceRoleKey = requiredEnvironmentValue(
        'SUPABASE_SERVICE_ROLE_KEY',
      );
      const vapidPublicKey = requiredEnvironmentValue('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = requiredEnvironmentValue('VAPID_PRIVATE_KEY');
      const vapidSubject = requiredEnvironmentValue('VAPID_SUBJECT');

      webPush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey,
      );

      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const claimResult = await supabase.rpc('claim_notification_jobs', {
        p_limit: 50,
      });

      if (claimResult.error) {
        console.error('Unable to claim notification jobs.', claimResult.error);
        return jsonResponse({ error: 'Unable to claim notification jobs.' }, 500);
      }

      const jobs = Array.isArray(claimResult.data)
        ? (claimResult.data as NotificationJob[])
        : [];

      let sentJobs = 0;
      let failedJobs = 0;
      let cancelledJobs = 0;

      for (const job of jobs) {
        const subscriptionsResult = await supabase
          .from('push_subscriptions')
          .select(
            'id, user_id, endpoint, p256dh_key, auth_key, failure_count',
          )
          .eq('user_id', job.user_id)
          .eq('is_active', true)
          .returns<PushSubscriptionRow[]>();

        if (subscriptionsResult.error) {
          console.error(
            `Unable to load subscriptions for job ${job.id}.`,
            subscriptionsResult.error,
          );

          await supabase
            .from('notification_jobs')
            .update({
              status: job.attempts >= 3 ? 'failed' : 'pending',
              scheduled_for: new Date(Date.now() + 5 * 60_000).toISOString(),
              last_error: 'Unable to load active push subscriptions.',
            })
            .eq('id', job.id);

          failedJobs += 1;
          continue;
        }

        const subscriptions = subscriptionsResult.data ?? [];

        if (subscriptions.length === 0) {
          await supabase
            .from('notification_jobs')
            .update({
              status: 'cancelled',
              last_error: 'No active push subscriptions remain.',
            })
            .eq('id', job.id);

          cancelledJobs += 1;
          continue;
        }

        const payload = JSON.stringify({
          title: job.title,
          body: job.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: `${job.notification_type}:${job.id}`,
          data: {
            url: job.route,
            notificationType: job.notification_type,
          },
        });

        let successfulDeliveries = 0;
        let retryableFailures = 0;

        for (const subscription of subscriptions) {
          try {
            await webPush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh_key,
                  auth: subscription.auth_key,
                },
              },
              payload,
              {
                TTL: 60 * 60 * 24,
                urgency:
                  job.notification_type === 'date_reminder'
                    ? 'high'
                    : 'normal',
              },
            );

            successfulDeliveries += 1;

            await supabase
              .from('push_subscriptions')
              .update({
                failure_count: 0,
                last_success_at: new Date().toISOString(),
                last_failure_at: null,
                last_error: null,
              })
              .eq('id', subscription.id);
          } catch (error) {
            const deliveryError = safeDeliveryError(error);
            const permanentFailure =
              deliveryError.statusCode === 404 ||
              deliveryError.statusCode === 410;

            if (!permanentFailure) {
              retryableFailures += 1;
            }

            console.error(
              `Push delivery failed for subscription ${subscription.id}.`,
              deliveryError,
            );

            await supabase
              .from('push_subscriptions')
              .update({
                is_active: permanentFailure ? false : true,
                failure_count: subscription.failure_count + 1,
                last_failure_at: new Date().toISOString(),
                last_error: deliveryError.message,
              })
              .eq('id', subscription.id);
          }
        }

        if (successfulDeliveries > 0) {
          await supabase
            .from('notification_jobs')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              last_error:
                retryableFailures > 0
                  ? 'Delivered to at least one device; another device failed.'
                  : null,
            })
            .eq('id', job.id);

          sentJobs += 1;
          continue;
        }

        const shouldRetry = retryableFailures > 0 && job.attempts < 3;

        await supabase
          .from('notification_jobs')
          .update({
            status: shouldRetry ? 'pending' : 'failed',
            scheduled_for: new Date(Date.now() + 5 * 60_000).toISOString(),
            last_error: shouldRetry
              ? 'Delivery failed temporarily and will be retried.'
              : 'Notification could not be delivered.',
          })
          .eq('id', job.id);

        failedJobs += 1;
      }

      return jsonResponse({
        claimed: jobs.length,
        sent: sentJobs,
        failed: failedJobs,
        cancelled: cancelledJobs,
      });
    } catch (error) {
      console.error('Notification worker failed.', error);
      return jsonResponse({ error: 'Notification worker failed.' }, 500);
    }
  },
};
