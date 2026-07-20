# Phase 2 profile-name update

This update adds structured `first_name` and `last_name` fields to each profile.

## Database step

Run the full contents of:

```text
supabase/migrations/0002_profile_names.sql
```

in the Supabase SQL Editor.

The migration sets the existing private accounts to:

- Stefan Saladino
- Ashna Samani

It also updates the automatic profile trigger so future accounts can store structured names.

## App result

- Dashboard greeting uses `first_name`: `Hello Stefan`
- Partner copy uses the partner's `first_name`
- Header avatar and accessibility label use the full name
