-- Notifications & Push Tokens for Morf
-- Run this in Supabase SQL Editor after 006_feed_posts.sql

-- ============================================
-- Table: push_tokens
-- Stores Expo push tokens for each user/device
-- ============================================
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  token text not null,
  device_type text, -- 'ios', 'android'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, token)
);

-- ============================================
-- Table: notifications
-- Stores notifications for users (friend PRs, etc.)
-- ============================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  type text not null, -- 'friend_pr', 'friend_workout', etc.
  from_user_id uuid references users(id) on delete cascade,
  data jsonb default '{}'::jsonb,
  -- For friend_pr: { "exercise_name": "Bench Press", "exercise_id": "bench-press-barbell", "weight": 225, "previous_pr": 215 }
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- Indexes
-- ============================================
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_user_unread on notifications(user_id, read) where read = false;
create index if not exists idx_notifications_created on notifications(created_at desc);
create index if not exists idx_push_tokens_user on push_tokens(user_id);
create index if not exists idx_push_tokens_token on push_tokens(token);

-- ============================================
-- Row Level Security
-- ============================================
alter table notifications enable row level security;
alter table push_tokens enable row level security;

drop policy if exists "Anyone can read notifications" on notifications;
drop policy if exists "Anyone can insert notifications" on notifications;
drop policy if exists "Anyone can update notifications" on notifications;
drop policy if exists "Anyone can delete notifications" on notifications;

create policy "Anyone can read notifications" on notifications for select using (true);
create policy "Anyone can insert notifications" on notifications for insert with check (true);
create policy "Anyone can update notifications" on notifications for update using (true);
create policy "Anyone can delete notifications" on notifications for delete using (true);

drop policy if exists "Anyone can read push_tokens" on push_tokens;
drop policy if exists "Anyone can insert push_tokens" on push_tokens;
drop policy if exists "Anyone can update push_tokens" on push_tokens;
drop policy if exists "Anyone can delete push_tokens" on push_tokens;

create policy "Anyone can read push_tokens" on push_tokens for select using (true);
create policy "Anyone can insert push_tokens" on push_tokens for insert with check (true);
create policy "Anyone can update push_tokens" on push_tokens for update using (true);
create policy "Anyone can delete push_tokens" on push_tokens for delete using (true);

-- ============================================
-- Function to create PR notifications for friends
-- ============================================
create or replace function notify_friends_of_pr(
  p_user_id uuid,
  p_exercise_id text,
  p_exercise_name text,
  p_new_pr numeric,
  p_previous_pr numeric
)
returns void as $$
begin
  -- Insert notification for each friend
  insert into notifications (user_id, type, from_user_id, data)
  select
    f.friend_id,
    'friend_pr',
    p_user_id,
    jsonb_build_object(
      'exercise_id', p_exercise_id,
      'exercise_name', p_exercise_name,
      'weight', p_new_pr,
      'previous_pr', p_previous_pr
    )
  from friends f
  where f.user_id = p_user_id;
end;
$$ language plpgsql;
