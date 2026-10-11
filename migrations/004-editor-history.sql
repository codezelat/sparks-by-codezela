ALTER TABLE revisions DROP CONSTRAINT revisions_action_check;
ALTER TABLE revisions ADD CONSTRAINT revisions_action_check CHECK (action IN ('draft','publish','unpublish'));
