-- Notifications System Migration
-- Creates notifications table with real-time support and RLS

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'emergency', 'approval', 'submission', 'reminder', 'meeting')),
  read BOOLEAN DEFAULT FALSE,
  urgent BOOLEAN DEFAULT FALSE,
  delivered_via TEXT[] DEFAULT '{}',
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  document_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_urgent ON public.notifications(urgent) WHERE urgent = TRUE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_document_id ON public.notifications(document_id) WHERE document_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own notifications (for system-generated ones)
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notifications (mark as read, etc.)
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- System/Admin can insert notifications for any user
CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'system')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS notifications_updated_at ON public.notifications;
CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- Function to create notification for document events
CREATE OR REPLACE FUNCTION create_document_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- Determine notification type and content based on document status
  IF NEW.status = 'approved' THEN
    notification_type := 'approval';
    notification_title := 'Document Approved';
    notification_message := 'Your document "' || NEW.title || '" has been approved.';
  ELSIF NEW.status = 'rejected' THEN
    notification_type := 'error';
    notification_title := 'Document Rejected';
    notification_message := 'Your document "' || NEW.title || '" has been rejected.';
  ELSIF NEW.status = 'in-review' THEN
    notification_type := 'info';
    notification_title := 'Document In Review';
    notification_message := 'Your document "' || NEW.title || '" is now under review.';
  ELSIF NEW.is_emergency = TRUE THEN
    notification_type := 'emergency';
    notification_title := 'Emergency Document';
    notification_message := 'Emergency document "' || NEW.title || '" requires immediate attention.';
  ELSE
    RETURN NEW;
  END IF;

  -- Create notification for document submitter
  IF NEW.submitter_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      urgent,
      document_id,
      metadata
    ) VALUES (
      NEW.submitter_id,
      notification_title,
      notification_message,
      notification_type,
      NEW.is_emergency OR NEW.priority = 'emergency',
      NEW.id,
      jsonb_build_object(
        'document_type', NEW.type,
        'document_status', NEW.status,
        'priority', NEW.priority
      )
    );
  END IF;

  -- Create notifications for recipients if status changed
  IF NEW.recipient_ids IS NOT NULL AND array_length(NEW.recipient_ids, 1) > 0 THEN
    FOREACH recipient_id IN ARRAY NEW.recipient_ids
    LOOP
      IF recipient_id != NEW.submitter_id THEN
        INSERT INTO public.notifications (
          user_id,
          title,
          message,
          type,
          urgent,
          document_id,
          metadata
        ) VALUES (
          recipient_id,
          'Document Update: ' || NEW.title,
          'Document status changed to ' || NEW.status,
          notification_type,
          NEW.is_emergency OR NEW.priority = 'emergency',
          NEW.id,
          jsonb_build_object(
            'document_type', NEW.type,
            'document_status', NEW.status,
            'priority', NEW.priority
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for document status changes
DROP TRIGGER IF EXISTS document_status_notification ON public.documents;
CREATE TRIGGER document_status_notification
  AFTER UPDATE OF status, is_emergency
  ON public.documents
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.is_emergency IS DISTINCT FROM OLD.is_emergency)
  EXECUTE FUNCTION create_document_notification();

-- Separate trigger for INSERT (cannot use OLD in WHEN clause)
DROP TRIGGER IF EXISTS document_insert_notification ON public.documents;
CREATE TRIGGER document_insert_notification
  AFTER INSERT
  ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION create_document_notification();

-- Function to auto-delete old read notifications (optional cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE read = TRUE
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create a view for unread notification counts
CREATE OR REPLACE VIEW public.notification_counts AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE read = FALSE) as unread_count,
  COUNT(*) FILTER (WHERE urgent = TRUE AND read = FALSE) as urgent_count,
  COUNT(*) as total_count
FROM public.notifications
GROUP BY user_id;

GRANT SELECT ON public.notification_counts TO authenticated;
