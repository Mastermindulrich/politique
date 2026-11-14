-- Photos, videos and files in direct messages.
--
-- Files live in a PRIVATE bucket, "politique-dm", under <conversation_id>/<sender_id>/<file>.
-- Only members of that conversation can read them (the app shows them through short-lived
-- signed URLs), and only the sender can upload into their own folder of a conversation
-- they belong to. messages.media (jsonb, already in 0001) holds one object per attachment:
--   { "type": "image" | "video" | "file", "path": "<conv>/<sender>/<file>",
--     "name": "...", "size": 123, "mime": "...", "width": 0, "height": 0 }
-- and every path must point inside the sender's own folder of that same conversation.
set search_path = politique, extensions, public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('politique-dm', 'politique-dm', false, 52428800, array[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
  'video/mp4','video/webm','video/quicktime','video/3gpp',
  'audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/webm','audio/x-m4a',
  'application/pdf','text/plain','text/csv','application/rtf','application/zip',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet',
  'application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Can the current user read (op = 'read') or write (op = 'write') this object of the bucket?
-- Never raises, even on a malformed path.
create or replace function dm_object_allowed(object_name text, op text) returns boolean
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare parts text[] := string_to_array(object_name, '/'); cid uuid;
begin
  if auth.uid() is null or array_length(parts, 1) <> 3 or parts[3] = '' then return false; end if;
  if parts[1] !~ '^[0-9a-f-]{36}$' then return false; end if;
  cid := parts[1]::uuid;
  if not is_conversation_member(cid) then return false; end if;
  if op = 'read' then return true; end if;
  return parts[2] = auth.uid()::text
     and not is_suspended(auth.uid())
     and feature_allowed('messages') and feature_allowed('media_uploads');
end $$;

drop policy if exists politique_dm_read on storage.objects;
drop policy if exists politique_dm_insert on storage.objects;
drop policy if exists politique_dm_delete on storage.objects;
create policy politique_dm_read on storage.objects for select
  using (bucket_id = 'politique-dm' and politique.dm_object_allowed(name, 'read'));
create policy politique_dm_insert on storage.objects for insert
  with check (bucket_id = 'politique-dm' and politique.dm_object_allowed(name, 'write'));
create policy politique_dm_delete on storage.objects for delete
  using (bucket_id = 'politique-dm' and politique.dm_object_allowed(name, 'write'));

-- Attachments of a message must sit in the sender's folder of the same conversation.
create or replace function dm_media_ok(cid uuid, sender uuid, media jsonb) returns boolean
language sql immutable set search_path = politique, extensions, public as $$
  select jsonb_typeof(media) = 'array'
    and jsonb_array_length(media) <= 10
    and not exists (
      select 1 from jsonb_array_elements(media) m
      where jsonb_typeof(m) <> 'object'
         or coalesce(m->>'type', '') not in ('image', 'video', 'file')
         or coalesce(m->>'path', '') !~ ('^' || cid::text || '/' || sender::text || '/[A-Za-z0-9._-]{1,120}$')
         or m ? 'url'
         or length(coalesce(m->>'name', '')) > 200)
$$;

drop policy if exists messages_media_ok on messages;
create policy messages_media_ok on messages as restrictive for insert to authenticated
  with check (dm_media_ok(conversation_id, sender_id, media));
drop policy if exists messages_media_ok_update on messages;
create policy messages_media_ok_update on messages as restrictive for update to authenticated
  with check (dm_media_ok(conversation_id, sender_id, media));

revoke execute on function dm_object_allowed(text, text) from public, anon;
grant execute on function dm_object_allowed(text, text) to authenticated, service_role;
grant execute on function dm_media_ok(uuid, uuid, jsonb) to authenticated, service_role;
