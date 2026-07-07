-- notification_counts is a VIEW and cannot be added to the supabase_realtime
-- publication (PostgreSQL only supports tables in publications, not views).
-- Attempting to toggle realtime for this object in the Supabase dashboard
-- caused: "cannot add relation 'notification_counts' to publication —
-- This operation is not supported for views."
--
-- The frontend computes unread/urgent counts entirely client-side from the
-- notifications table realtime subscription (useSupabaseNotifications.ts),
-- so this view is unused and safe to drop.
DROP VIEW IF EXISTS public.notification_counts;
