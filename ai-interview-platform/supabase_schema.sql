-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users table (Links to Supabase Auth)
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  name text,
  email text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Interviews table
create table if not exists public.interviews (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  job_role text not null,
  company_name text,
  interview_round text,
  language text default 'en-US',
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  num_questions integer not null,
  jd_text text,
  final_score integer,
  duration_seconds integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Responses table
create table if not exists public.responses (
  id uuid default uuid_generate_v4() primary key,
  interview_id uuid references public.interviews(id) not null,
  question_text text not null,
  user_answer text,
  ai_feedback text,
  rating integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table public.users enable row level security;
alter table public.interviews enable row level security;
alter table public.responses enable row level security;

-- Create Policies

-- Users can read and update their own profile
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Users can read and insert their own interviews
create policy "Users can view own interviews" on public.interviews for select using (auth.uid() = user_id);
create policy "Users can insert own interviews" on public.interviews for insert with check (auth.uid() = user_id);
create policy "Users can update own interviews" on public.interviews for update using (auth.uid() = user_id);

-- Users can read, insert, and update responses linked to their interviews
create policy "Users can view own responses" on public.responses for select using (
  exists (
    select 1 from public.interviews
    where interviews.id = responses.interview_id and interviews.user_id = auth.uid()
  )
);
create policy "Users can insert own responses" on public.responses for insert with check (
  exists (
    select 1 from public.interviews
    where interviews.id = responses.interview_id and interviews.user_id = auth.uid()
  )
);

-- Function to handle user creation on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user profile on sign up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
