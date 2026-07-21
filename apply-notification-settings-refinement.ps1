#Requires -Version 5.1

<#
.SYNOPSIS
Applies the Together notification-settings refinement.

.DESCRIPTION
This script:

- Adds a dedicated /settings page.
- Moves the existing notification settings card off the Dashboard.
- Adds a header gear shortcut.
- Adds separate preferences for new ideas and saved places.
- Adds explicit PWA badge clearing.
- Creates migration 0011.
- Leaves VAPID keys, Edge Function secrets, Cron, and Vault unchanged.
#>

param(
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Resolve-ProjectPath {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  return Join-Path $ProjectRoot $RelativePath
}

function Write-ProjectFile {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $path = Resolve-ProjectPath $RelativePath
  $directory = Split-Path $path -Parent

  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  [System.IO.File]::WriteAllText($path, $Content, $utf8NoBom)

  Write-Host "Created: $RelativePath" -ForegroundColor Green
}

function Read-RequiredFile {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $path = Resolve-ProjectPath $RelativePath

  if (-not (Test-Path $path)) {
    throw "Required file was not found: $RelativePath"
  }

  return [System.IO.File]::ReadAllText($path)
}

function Save-ExistingFile {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $path = Resolve-ProjectPath $RelativePath
  [System.IO.File]::WriteAllText($path, $Content, $utf8NoBom)

  Write-Host "Updated: $RelativePath" -ForegroundColor Cyan
}

# =========================================================
# NEW FILE: PWA BADGE CLEARING
# =========================================================

Write-ProjectFile "src/pwa/registerBadgeClearing.ts" @'
/**
 * Badge-capable browser interfaces are still not represented consistently in
 * every TypeScript DOM library, so the optional methods are declared locally.
 */
interface BadgeCapableNavigator extends Navigator {
  clearAppBadge?: () => Promise<void>;
}

interface BadgeCapableRegistration extends ServiceWorkerRegistration {
  clearAppBadge?: () => Promise<void>;
}

/**
 * Clears the Home Screen application badge through both the page and active
 * service worker APIs. Every operation is best-effort because unsupported
 * browsers should continue normally.
 */
async function clearApplicationBadge(): Promise<void> {
  if (typeof navigator === 'undefined') {
    return;
  }

  const badgeNavigator = navigator as BadgeCapableNavigator;

  try {
    if (typeof badgeNavigator.clearAppBadge === 'function') {
      await badgeNavigator.clearAppBadge();
    }
  } catch {
    // Badge clearing must never prevent the application from loading.
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration =
      (await navigator.serviceWorker.ready) as BadgeCapableRegistration;

    if (typeof registration.clearAppBadge === 'function') {
      await registration.clearAppBadge();
    }

    registration.active?.postMessage({
      type: 'CLEAR_APP_BADGE',
    });
  } catch {
    // The service worker may still be installing during the first app opening.
  }
}

function requestBadgeClear(): void {
  void clearApplicationBadge();
}

/**
 * Clear immediately and whenever the installed PWA becomes active again.
 */
if (typeof window !== 'undefined') {
  requestBadgeClear();

  window.addEventListener('focus', requestBadgeClear);
  window.addEventListener('pageshow', requestBadgeClear);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestBadgeClear();
    }
  });
}
'@

# =========================================================
# NEW FILE: HEADER SETTINGS SHORTCUT
# =========================================================

Write-ProjectFile "src/components/layout/SettingsShortcut.tsx" @'
import { NavLink } from 'react-router-dom';

/**
 * Fixed header shortcut for application settings.
 *
 * It is rendered inside the protected AppShell, so it never appears on the
 * public login page.
 */
export function SettingsShortcut() {
  return (
    <NavLink
      aria-label="Open settings"
      className={({ isActive }) =>
        `settings-shortcut${isActive ? ' is-active' : ''}`
      }
      title="Settings"
      to="/settings"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="22"
        viewBox="0 0 24 24"
        width="22"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.09.37.3.72.6 1 .3.27.69.41 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6Z" />
      </svg>
    </NavLink>
  );
}
'@

# =========================================================
# NEW FILE: CONTENT NOTIFICATION PREFERENCES
# =========================================================

Write-ProjectFile "src/components/notifications/ContentNotificationPreferencesCard.tsx" @'
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ContentNotificationPreferences {
  new_ideas_enabled: boolean;
  new_places_enabled: boolean;
}

interface RpcResponse {
  data: unknown;
  error: {
    message: string;
  } | null;
}

interface RpcCapableClient {
  rpc: (
    functionName: string,
    parameters?: Record<string, unknown>,
  ) => Promise<RpcResponse>;
}

const notificationClient = supabase as unknown as RpcCapableClient;

function readPreferenceRow(data: unknown): ContentNotificationPreferences {
  const candidate = Array.isArray(data) ? data[0] : data;

  if (!candidate || typeof candidate !== 'object') {
    return {
      new_ideas_enabled: false,
      new_places_enabled: false,
    };
  }

  const row = candidate as Partial<ContentNotificationPreferences>;

  return {
    new_ideas_enabled: row.new_ideas_enabled === true,
    new_places_enabled: row.new_places_enabled === true,
  };
}

/**
 * Separate controls for optional partner-created content notifications.
 *
 * These preferences belong to the signed-in user. Turning an option on means
 * this user wants to be notified when their partner creates that content.
 */
export function ContentNotificationPreferencesCard() {
  const [ideasEnabled, setIdeasEnabled] = useState(false);
  const [placesEnabled, setPlacesEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function loadPreferences(): Promise<void> {
      setIsLoading(true);
      setErrorMessage('');

      const { data, error } = await notificationClient.rpc(
        'get_content_notification_preferences',
      );

      if (isCancelled) {
        return;
      }

      if (error) {
        setErrorMessage(
          'Unable to load the additional notification preferences.',
        );
        setIsLoading(false);
        return;
      }

      const preferences = readPreferenceRow(data);

      setIdeasEnabled(preferences.new_ideas_enabled);
      setPlacesEnabled(preferences.new_places_enabled);
      setIsLoading(false);
    }

    void loadPreferences();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await notificationClient.rpc(
      'set_content_notification_preferences',
      {
        p_new_ideas_enabled: ideasEnabled,
        p_new_places_enabled: placesEnabled,
      },
    );

    if (error) {
      setErrorMessage('Unable to save the additional notification preferences.');
      setIsSaving(false);
      return;
    }

    setSuccessMessage('Content notification preferences saved.');
    setIsSaving(false);
  }

  return (
    <section
      aria-labelledby="content-notification-heading"
      className="settings-card"
    >
      <div className="settings-card__header">
        <div>
          <p className="settings-card__eyebrow">Partner activity</p>
          <h2 id="content-notification-heading">New ideas and places</h2>
        </div>
      </div>

      <p className="settings-card__description">
        Choose whether Together should notify you when your partner adds a new
        date idea or saves a new place. The person creating the item does not
        receive their own notification.
      </p>

      {isLoading ? (
        <p aria-live="polite" className="settings-card__status">
          Loading preferences…
        </p>
      ) : (
        <div className="settings-toggle-list">
          <label className="settings-toggle">
            <span className="settings-toggle__copy">
              <strong>New date ideas</strong>
              <small>
                Notify me when my partner adds an idea to our shared list.
              </small>
            </span>

            <input
              checked={ideasEnabled}
              onChange={(event) => {
                setIdeasEnabled(event.target.checked);
                setSuccessMessage('');
              }}
              type="checkbox"
            />

            <span aria-hidden="true" className="settings-toggle__control" />
          </label>

          <label className="settings-toggle">
            <span className="settings-toggle__copy">
              <strong>New saved places</strong>
              <small>
                Notify me when my partner adds a place to our shared map.
              </small>
            </span>

            <input
              checked={placesEnabled}
              onChange={(event) => {
                setPlacesEnabled(event.target.checked);
                setSuccessMessage('');
              }}
              type="checkbox"
            />

            <span aria-hidden="true" className="settings-toggle__control" />
          </label>
        </div>
      )}

      {errorMessage ? (
        <p aria-live="assertive" className="settings-card__message is-error">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p aria-live="polite" className="settings-card__message is-success">
          {successMessage}
        </p>
      ) : null}

      <button
        className="button button--primary settings-card__save"
        disabled={isLoading || isSaving}
        onClick={() => {
          void handleSave();
        }}
        type="button"
      >
        {isSaving ? 'Saving…' : 'Save content alerts'}
      </button>
    </section>
  );
}
'@

# =========================================================
# NEW FILE: SETTINGS PAGE
# =========================================================

Write-ProjectFile "src/pages/SettingsPage.tsx" @'
import { ContentNotificationPreferencesCard } from '../components/notifications/ContentNotificationPreferencesCard';
import { NotificationSettingsCard } from '../components/notifications/NotificationSettingsCard';

/**
 * Dedicated settings surface.
 *
 * Device permission, push subscription management, reminder timing, quiet
 * hours, and partner-content alerts now live outside the Dashboard.
 */
export default function SettingsPage() {
  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <p className="settings-page__eyebrow">Together preferences</p>
        <h1>Settings</h1>
        <p>
          Configure notifications for this account and device. Each partner can
          choose their own preferences independently.
        </p>
      </header>

      <div className="settings-page__content">
        <NotificationSettingsCard />
        <ContentNotificationPreferencesCard />
      </div>
    </div>
  );
}
'@

# =========================================================
# NEW FILE: SETTINGS STYLES
# =========================================================

Write-ProjectFile "src/styles/settings.css" @'
/* =========================================================
   SETTINGS SHORTCUT
========================================================= */

.settings-shortcut {
  position: fixed;
  z-index: 90;
  top: calc(0.82rem + env(safe-area-inset-top));
  right: max(
    calc(4.1rem + env(safe-area-inset-right)),
    calc((100vw - 48rem) / 2 + 4.1rem)
  );
  width: 2.65rem;
  height: 2.65rem;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  backdrop-filter: blur(10px);
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.settings-shortcut:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.2);
}

.settings-shortcut.is-active {
  border-color: rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.24);
}

.settings-shortcut svg {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

/* =========================================================
   SETTINGS PAGE
========================================================= */

.settings-page {
  display: grid;
  gap: 1.2rem;
  padding-bottom: 1rem;
}

.settings-page__header {
  display: grid;
  gap: 0.45rem;
}

.settings-page__eyebrow,
.settings-card__eyebrow {
  margin: 0;
  color: var(--color-accent);
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-page__header h1 {
  margin: 0;
  font-size: clamp(1.85rem, 8vw, 2.65rem);
}

.settings-page__header > p:last-child {
  max-width: 38rem;
  margin: 0;
  color: var(--color-muted);
  line-height: 1.6;
}

.settings-page__content {
  display: grid;
  gap: 1rem;
}

.settings-card {
  display: grid;
  gap: 1rem;
  padding: 1.1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.settings-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.settings-card__header h2 {
  margin: 0.22rem 0 0;
  font-size: 1.28rem;
}

.settings-card__description,
.settings-card__status {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.55;
}

.settings-toggle-list {
  display: grid;
  gap: 0.75rem;
}

.settings-toggle {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 4.45rem;
  padding: 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
  cursor: pointer;
}

.settings-toggle__copy {
  display: grid;
  gap: 0.2rem;
}

.settings-toggle__copy strong {
  color: var(--color-ink);
  font-size: 0.92rem;
}

.settings-toggle__copy small {
  color: var(--color-muted);
  font-size: 0.76rem;
  line-height: 1.45;
}

.settings-toggle input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.settings-toggle__control {
  position: relative;
  width: 3rem;
  height: 1.72rem;
  flex: 0 0 auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: #d7d2d4;
  transition:
    background 160ms ease,
    border-color 160ms ease;
}

.settings-toggle__control::after {
  content: '';
  position: absolute;
  top: 0.17rem;
  left: 0.18rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 5px rgba(43, 32, 37, 0.2);
  transition: transform 160ms ease;
}

.settings-toggle input:checked + .settings-toggle__control {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.settings-toggle input:checked + .settings-toggle__control::after {
  transform: translateX(1.25rem);
}

.settings-toggle:focus-within {
  border-color: rgba(141, 63, 91, 0.45);
  box-shadow: 0 0 0 3px rgba(141, 63, 91, 0.1);
}

.settings-card__message {
  margin: 0;
  padding: 0.72rem 0.8rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  line-height: 1.45;
}

.settings-card__message.is-error {
  background: rgba(151, 41, 51, 0.1);
  color: #842d36;
}

.settings-card__message.is-success {
  background: rgba(75, 117, 77, 0.12);
  color: #486047;
}

.settings-card__save {
  justify-self: start;
}

@media (min-width: 42rem) {
  .settings-page__content {
    gap: 1.2rem;
  }

  .settings-card {
    padding: 1.35rem;
  }

  .settings-toggle-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
'@

# =========================================================
# NEW FILE: DATABASE MIGRATION
# =========================================================

Write-ProjectFile "supabase/migrations/0011_notification_settings_and_content_alerts.sql" @'
-- =========================================================
-- PHASE 9 REFINEMENT:
-- SETTINGS, CONTENT ALERTS, AND BADGE SUPPORT
-- =========================================================

begin;

-- ---------------------------------------------------------
-- Per-user opt-in preferences
-- ---------------------------------------------------------

alter table public.notification_preferences
  add column if not exists new_ideas_enabled boolean not null default false,
  add column if not exists new_places_enabled boolean not null default false;

-- ---------------------------------------------------------
-- Keep notification type constraints forward-compatible.
--
-- Surprise notes remain explicitly prohibited from the push queue.
-- ---------------------------------------------------------

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name in (
        select constraint_name
        from information_schema.constraint_column_usage
        where table_schema = 'public'
          and table_name = 'notification_jobs'
          and column_name = 'notification_type'
      )
  loop
    execute format(
      'alter table public.notification_jobs drop constraint if exists %I',
      v_constraint.constraint_name
    );
  end loop;
end;
$$;

alter table public.notification_jobs
  drop constraint if exists notification_jobs_notification_type_format_check;

alter table public.notification_jobs
  add constraint notification_jobs_notification_type_format_check
  check (
    notification_type ~ '^[a-z][a-z0-9_]{0,63}$'
    and notification_type <> 'surprise_note'
  );

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name in (
        select constraint_name
        from information_schema.constraint_column_usage
        where table_schema = 'public'
          and table_name = 'notification_jobs'
          and column_name = 'related_entity_type'
      )
  loop
    execute format(
      'alter table public.notification_jobs drop constraint if exists %I',
      v_constraint.constraint_name
    );
  end loop;
end;
$$;

alter table public.notification_jobs
  drop constraint if exists notification_jobs_related_entity_type_format_check;

alter table public.notification_jobs
  add constraint notification_jobs_related_entity_type_format_check
  check (
    related_entity_type is null
    or related_entity_type ~ '^[a-z][a-z0-9_]{0,63}$'
  );

-- ---------------------------------------------------------
-- Safe preference readers and writers
-- ---------------------------------------------------------

create or replace function public.get_content_notification_preferences()
returns table (
  new_ideas_enabled boolean,
  new_places_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  insert into public.notification_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return query
  select
    preferences.new_ideas_enabled,
    preferences.new_places_enabled
  from public.notification_preferences as preferences
  where preferences.user_id = v_user_id;
end;
$$;

create or replace function public.set_content_notification_preferences(
  p_new_ideas_enabled boolean,
  p_new_places_enabled boolean
)
returns table (
  new_ideas_enabled boolean,
  new_places_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  insert into public.notification_preferences (
    user_id,
    new_ideas_enabled,
    new_places_enabled,
    updated_at
  )
  values (
    v_user_id,
    coalesce(p_new_ideas_enabled, false),
    coalesce(p_new_places_enabled, false),
    now()
  )
  on conflict (user_id)
  do update set
    new_ideas_enabled = excluded.new_ideas_enabled,
    new_places_enabled = excluded.new_places_enabled,
    updated_at = now();

  return query
  select
    preferences.new_ideas_enabled,
    preferences.new_places_enabled
  from public.notification_preferences as preferences
  where preferences.user_id = v_user_id;
end;
$$;

revoke all
on function public.get_content_notification_preferences()
from public;

revoke all
on function public.set_content_notification_preferences(boolean, boolean)
from public;

grant execute
on function public.get_content_notification_preferences()
to authenticated;

grant execute
on function public.set_content_notification_preferences(boolean, boolean)
to authenticated;

-- ---------------------------------------------------------
-- Internal content-alert queue helper
-- ---------------------------------------------------------

create or replace function public.queue_content_notification(
  p_user_id uuid,
  p_notification_type text,
  p_title text,
  p_body text,
  p_route text,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preferences public.notification_preferences%rowtype;
  v_local_now timestamp without time zone;
  v_local_time time without time zone;
  v_target_date date;
  v_scheduled_for timestamptz := now();
  v_is_enabled boolean := false;
begin
  if p_notification_type not in ('new_idea', 'new_place') then
    raise exception 'Unsupported content notification type.';
  end if;

  select *
  into v_preferences
  from public.notification_preferences
  where user_id = p_user_id;

  if not found then
    return;
  end if;

  if p_notification_type = 'new_idea' then
    v_is_enabled := v_preferences.new_ideas_enabled;
  elsif p_notification_type = 'new_place' then
    v_is_enabled := v_preferences.new_places_enabled;
  end if;

  if not v_is_enabled then
    return;
  end if;

  -- Respect this user's existing quiet-hour preferences.
  if v_preferences.quiet_hours_enabled
    and v_preferences.quiet_hours_start is distinct from
      v_preferences.quiet_hours_end then

    v_local_now := timezone(
      coalesce(v_preferences.timezone, 'America/Toronto'),
      now()
    );

    v_local_time := v_local_now::time;
    v_target_date := v_local_now::date;

    if v_preferences.quiet_hours_start
      < v_preferences.quiet_hours_end then

      if v_local_time >= v_preferences.quiet_hours_start
        and v_local_time < v_preferences.quiet_hours_end then

        v_scheduled_for := (
          v_target_date + v_preferences.quiet_hours_end
        ) at time zone coalesce(
          v_preferences.timezone,
          'America/Toronto'
        );
      end if;

    elsif v_local_time >= v_preferences.quiet_hours_start then

      v_scheduled_for := (
        (v_target_date + 1) + v_preferences.quiet_hours_end
      ) at time zone coalesce(
        v_preferences.timezone,
        'America/Toronto'
      );

    elsif v_local_time < v_preferences.quiet_hours_end then

      v_scheduled_for := (
        v_target_date + v_preferences.quiet_hours_end
      ) at time zone coalesce(
        v_preferences.timezone,
        'America/Toronto'
      );

    end if;
  end if;

  insert into public.notification_jobs (
    user_id,
    notification_type,
    title,
    body,
    route,
    related_entity_type,
    related_entity_id,
    dedupe_key,
    scheduled_for
  )
  values (
    p_user_id,
    p_notification_type,
    left(p_title, 120),
    left(p_body, 240),
    p_route,
    p_related_entity_type,
    p_related_entity_id,
    p_dedupe_key,
    v_scheduled_for
  )
  on conflict do nothing;
end;
$$;

revoke all
on function public.queue_content_notification(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
)
from public;

-- ---------------------------------------------------------
-- New date-idea alerts
-- ---------------------------------------------------------

create or replace function public.queue_new_date_idea_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient record;
begin
  for v_recipient in
    select members.user_id
    from public.couple_members as members
    where members.couple_id = new.couple_id
      and members.user_id <> new.created_by
  loop
    perform public.queue_content_notification(
      v_recipient.user_id,
      'new_idea',
      'New date idea',
      'Your partner added "' ||
        left(coalesce(new.title, 'a new idea'), 120) ||
        '".',
      '/ideas',
      'date_idea',
      new.id,
      'content:new_idea:' ||
        new.id::text ||
        ':' ||
        v_recipient.user_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists date_ideas_queue_partner_notification
on public.date_ideas;

create trigger date_ideas_queue_partner_notification
after insert
on public.date_ideas
for each row
execute function public.queue_new_date_idea_notifications();

-- ---------------------------------------------------------
-- New saved-place alerts
-- ---------------------------------------------------------

create or replace function public.queue_new_place_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient record;
begin
  for v_recipient in
    select members.user_id
    from public.couple_members as members
    where members.couple_id = new.couple_id
      and members.user_id <> new.created_by
  loop
    perform public.queue_content_notification(
      v_recipient.user_id,
      'new_place',
      'New saved place',
      'Your partner saved "' ||
        left(coalesce(new.name, 'a new place'), 120) ||
        '".',
      '/places',
      'place',
      new.id,
      'content:new_place:' ||
        new.id::text ||
        ':' ||
        v_recipient.user_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists places_queue_partner_notification
on public.places;

create trigger places_queue_partner_notification
after insert
on public.places
for each row
execute function public.queue_new_place_notifications();

notify pgrst, 'reload schema';

commit;
'@

# =========================================================
# PATCH: MAIN ENTRY
# =========================================================

$mainPath = "src/main.tsx"
$main = Read-RequiredFile $mainPath
$badgeImport = "import './pwa/registerBadgeClearing';"

if (-not $main.Contains($badgeImport)) {
  $main = $badgeImport + [Environment]::NewLine + $main
  Save-ExistingFile $mainPath $main
} else {
  Write-Host "Already integrated: $mainPath" -ForegroundColor DarkGray
}

# =========================================================
# PATCH: ROUTER
# =========================================================

$routesPath = "src/app/AppRoutes.tsx"
$routes = Read-RequiredFile $routesPath

if (-not $routes.Contains("const SettingsPage = lazy")) {
  $firstLazyDeclaration = [regex]::Match(
    $routes,
    "(?m)^const\s+[A-Za-z0-9_]+Page\s*=\s*lazy"
  )

  if (-not $firstLazyDeclaration.Success) {
    throw "Unable to locate the lazy page declarations in $routesPath."
  }

  $settingsDeclaration =
    "const SettingsPage = lazy(() => import('../pages/SettingsPage'));" +
    [Environment]::NewLine

  $routes = $routes.Insert(
    $firstLazyDeclaration.Index,
    $settingsDeclaration
  )
}

if ($routes -notmatch 'path=["'']settings["'']') {
  $notesRoute = [regex]::Match(
    $routes,
    '(?m)^(?<indent>\s*)<Route\s+path=["'']notes["'']'
  )

  if (-not $notesRoute.Success) {
    throw "Unable to locate the Notes route in $routesPath."
  }

  $indent = $notesRoute.Groups["indent"].Value
  $settingsRoute =
    $indent +
    '<Route path="settings" element={<SettingsPage />} />' +
    [Environment]::NewLine

  $routes = $routes.Insert($notesRoute.Index, $settingsRoute)
}

Save-ExistingFile $routesPath $routes

# =========================================================
# PATCH: APP SHELL
# =========================================================

$appShellPath = "src/components/layout/AppShell.tsx"
$appShell = Read-RequiredFile $appShellPath
$shortcutImport = "import { SettingsShortcut } from './SettingsShortcut';"

if (-not $appShell.Contains($shortcutImport)) {
  $appShell = $shortcutImport + [Environment]::NewLine + $appShell
}

if (-not $appShell.Contains("<SettingsShortcut />")) {
  $bottomNavigationMatch = [regex]::Match(
    $appShell,
    '(?m)^(?<indent>\s*)<BottomNavigation'
  )

  if (-not $bottomNavigationMatch.Success) {
    throw "Unable to locate BottomNavigation in $appShellPath."
  }

  $shortcutMarkup =
    $bottomNavigationMatch.Groups["indent"].Value +
    "<SettingsShortcut />" +
    [Environment]::NewLine

  $appShell = $appShell.Insert(
    $bottomNavigationMatch.Index,
    $shortcutMarkup
  )
}

Save-ExistingFile $appShellPath $appShell

# =========================================================
# PATCH: REMOVE NOTIFICATION CARD FROM DASHBOARD
# =========================================================

$dashboardPath = "src/pages/DashboardPage.tsx"
$dashboard = Read-RequiredFile $dashboardPath

$dashboard = [regex]::Replace(
  $dashboard,
  '(?m)^\s*import[^\r\n]*NotificationSettingsCard[^\r\n]*\r?\n',
  ''
)

$dashboard = [regex]::Replace(
  $dashboard,
  '(?m)^\s*<NotificationSettingsCard\s*/>\s*\r?\n',
  ''
)

Save-ExistingFile $dashboardPath $dashboard

# =========================================================
# PATCH: STYLE ENTRY
# =========================================================

$styleIndexPath = "src/styles/index.css"
$styleIndex = Read-RequiredFile $styleIndexPath
$settingsStyleImport = "@import './settings.css';"

if (-not $styleIndex.Contains($settingsStyleImport)) {
  $styleIndex =
    $settingsStyleImport +
    [Environment]::NewLine +
    $styleIndex
}

Save-ExistingFile $styleIndexPath $styleIndex

# =========================================================
# PATCH: SERVICE WORKER BADGE CLEARING
# =========================================================

$serviceWorkerPath = "public/service-worker.js"
$serviceWorker = Read-RequiredFile $serviceWorkerPath
$badgeMarker = "TOGETHER_BADGE_CLEAR_REFINEMENT"

if (-not $serviceWorker.Contains($badgeMarker)) {
  $serviceWorker += @'

/* =========================================================
   TOGETHER_BADGE_CLEAR_REFINEMENT
========================================================= */

/**
 * Clears the installed PWA badge when supported.
 */
async function clearTogetherApplicationBadge() {
  try {
    if (typeof self.registration.clearAppBadge === 'function') {
      await self.registration.clearAppBadge();
    }
  } catch {
    // Badge support is optional and must not interrupt push handling.
  }
}

/**
 * The open application asks the worker to clear its badge whenever it becomes
 * visible or active.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CLEAR_APP_BADGE') {
    return;
  }

  event.waitUntil(clearTogetherApplicationBadge());
});

/**
 * Clearing a displayed notification should also clear the Home Screen badge.
 */
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(clearTogetherApplicationBadge());
});

/**
 * The existing notification-click listener still performs routing. This
 * additional listener handles only the independent badge state.
 */
self.addEventListener('notificationclick', (event) => {
  event.waitUntil(clearTogetherApplicationBadge());
});
'@

  Save-ExistingFile $serviceWorkerPath $serviceWorker
} else {
  Write-Host "Already integrated: $serviceWorkerPath" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Notification settings refinement applied." -ForegroundColor Green
Write-Host ""
Write-Host "Next:"
Write-Host "1. Run migration 0011 in Supabase SQL Editor."
Write-Host "2. Run npm validation commands."
Write-Host "3. Test both partner accounts."