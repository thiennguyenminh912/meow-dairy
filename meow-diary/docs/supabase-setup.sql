-- Meow Diary — chạy một lần trong Supabase Dashboard → SQL Editor → New query → Run
-- Tạo bảng lưu nhật ký theo từng người dùng + Row Level Security (mỗi người chỉ thấy dữ liệu của mình)

create table if not exists public.diaries (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.diaries enable row level security;

drop policy if exists "diaries_select_own" on public.diaries;
create policy "diaries_select_own" on public.diaries
  for select using (auth.uid() = user_id);

drop policy if exists "diaries_insert_own" on public.diaries;
create policy "diaries_insert_own" on public.diaries
  for insert with check (auth.uid() = user_id);

drop policy if exists "diaries_update_own" on public.diaries;
create policy "diaries_update_own" on public.diaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "diaries_delete_own" on public.diaries;
create policy "diaries_delete_own" on public.diaries
  for delete using (auth.uid() = user_id);
