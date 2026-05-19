-- Add on-disk upload path for audit / re-processing
ALTER TABLE extractions
  ADD COLUMN IF NOT EXISTS file_path TEXT;
