
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aquecimento-status-images',
  'aquecimento-status-images',
  true,
  10485760,
  ARRAY['image/png','image/jpeg','image/jpg','image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;
