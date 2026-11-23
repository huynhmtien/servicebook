-- ServiceBook no longer stores record images: images are only sent to the AI to read and then discarded.
ALTER TABLE service_records DROP COLUMN image_path;
ALTER TABLE drafts DROP COLUMN image_path;
