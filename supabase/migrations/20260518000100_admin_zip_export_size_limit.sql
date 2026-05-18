-- PLAN-0099 Admin ZIP Export Production Size Resilience
--
-- Production render ZIP artifacts can exceed the original 50 MB catalog
-- private bucket object limit. Raise only this private catalog bucket so
-- admin ZIP exports remain private while real sofa render sets can be stored.

update storage.buckets
set
  file_size_limit = 209715200,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip'
  ]
where id = 'catalog-private-assets';
