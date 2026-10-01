-- ==============================================================================
-- ANONY SEED DATA: For local development and demonstration
-- ==============================================================================

-- 1. Insert Mock Auth Users (if not present)
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice@example.com',
    -- bcrypt hash for 'password123'
    '$2a$10$w6z9Vb3EaQpT6t9VqZ3iQ.4sP6c2K1B8qV2Z6Y1c3T5v7B9d1e3g.',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"alice"}',
    now(),
    now()
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob@example.com',
    '$2a$10$w6z9Vb3EaQpT6t9VqZ3iQ.4sP6c2K1B8qV2Z6Y1c3T5v7B9d1e3g.',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"bob"}',
    now(),
    now()
  )
on conflict (id) do nothing;

-- 2. Insert Profiles
insert into public.profiles (id, username, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'alice', now() - interval '2 days', now()),
  ('b0000000-0000-0000-0000-000000000002', 'bob', now() - interval '1 day', now())
on conflict (id) do update set username = excluded.username;

-- 3. Insert Messages for Alice
insert into public.messages (id, recipient_id, body, is_read, created_at)
values
  (
    'm0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'I really love your design work! You are such an inspiration to the whole team.',
    false,
    now() - interval '2 hours'
  ),
  (
    'm0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Secretly hoping you notice me in class tomorrow 😊',
    true,
    now() - interval '5 hours'
  ),
  (
    'm0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'What song have you had on repeat all week?',
    false,
    now() - interval '15 minutes'
  )
on conflict (id) do nothing;

-- 4. Insert Messages for Bob
insert into public.messages (id, recipient_id, body, is_read, created_at)
values
  (
    'm0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000002',
    'Bob, your tech talk last week was so cool!',
    false,
    now() - interval '1 hour'
  )
on conflict (id) do nothing;

-- 5. Insert Message Meta (Server side hashes only)
insert into public.message_meta (message_id, device_hash, ip_hash, created_at)
values
  ('m0000000-0000-0000-0000-000000000001', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2', now() - interval '2 hours'),
  ('m0000000-0000-0000-0000-000000000002', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', now() - interval '5 hours'),
  ('m0000000-0000-0000-0000-000000000003', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2', now() - interval '15 minutes'),
  ('m0000000-0000-0000-0000-000000000004', '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4', '7d793037a0760186574b0282f2f435e7b1e50774690f45041ec3a700fb7b5014', now() - interval '1 hour')
on conflict (message_id) do nothing;
