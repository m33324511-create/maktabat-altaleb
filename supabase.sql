-- مكتبة الطالب: إعداد قاعدة البيانات والتخزين
-- شغّل هذا الملف كاملًا في Supabase Dashboard > SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default 'أخرى',
  description text not null default '',
  file_path text not null unique,
  file_url text not null,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

drop policy if exists "Public can read books" on public.books;
create policy "Public can read books"
on public.books
for select
to anon, authenticated
using (true);

-- لا توجد سياسات INSERT/UPDATE/DELETE للزوار.
-- دالة Edge Function تستخدم service_role لإضافة الكتب بعد التحقق من كلمة المرور.

insert into storage.buckets (id, name, public)
values ('books', 'books', true)
on conflict (id) do update set public = true;
