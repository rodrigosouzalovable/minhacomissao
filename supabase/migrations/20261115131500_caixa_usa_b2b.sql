insert into public.meta_inbox_folders (id, nome, cor, owner_id)
values ('7b3e9a10-4c2d-4f8e-9a61-0d5e2c8b1a47', 'USA B2B', '#2563eb', 'ee649720-b8ce-47a2-859e-100a3a9ae6bb')
on conflict (id) do nothing;
