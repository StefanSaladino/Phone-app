# Live surprise notes and place-form usability update

## Surprise-note delivery

- Pending surprise notes are checked whenever the authenticated app shell opens.
- The controller re-checks when the installed PWA returns to the foreground,
  regains focus, or reconnects after being offline.
- Supabase Realtime listens for new notes addressed to the current user.
- A surprise note appears immediately while the recipient is already using the
  app. If the app is closed, the same note appears the next time it opens.
- This is in-app Realtime delivery, not an iOS lock-screen push notification.

Run `supabase/migrations/0005_realtime_surprise_notes.sql` in the Supabase SQL
Editor before testing live delivery.

## Place form

- Replaced the oversized scrolling modal with a constrained mobile bottom sheet.
- The title and close button remain fixed at the top of the sheet.
- Only the form fields scroll.
- Cancel and Save remain fixed above the iPhone safe area.
- Opening the form no longer automatically opens the keyboard.
- Backdrop taps and Escape close the form when it is not saving.
- Background-page scrolling is locked while the sheet is open.
