-- Incremental migration. No rows are removed or merged. Run only after reviewing the deployed schema.
begin;

-- The existing app already depends on this base contract; abort instead of guessing missing columns.
do $$
declare field text;
begin
  foreach field in array array['id','user_id','name','price','strategy','saved_at','hold_until','planned_weekly_save','updated_at'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wishlist_items' and column_name = field) then
      raise exception 'Wishlist prerequisite missing: %', field;
    end if;
  end loop;
  foreach field in array array['id','wisdom_xp','streak_count'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = field) then
      raise exception 'Profile prerequisite missing: %', field;
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.pg_index i where i.indrelid = 'public.wishlist_items'::regclass and i.indisunique
      and (pg_catalog.pg_get_expr(i.indexprs,i.indrelid) ~ '\mname\M' or exists (
        select 1 from unnest(i.indkey) with ordinality k(attnum,pos)
          join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
          where k.pos<=i.indnkeyatts and a.attname='name'))
      and not (coalesce(pg_catalog.pg_get_expr(i.indexprs,i.indrelid) ~ '\mprice\M',false) or exists (
        select 1 from unnest(i.indkey) with ordinality k(attnum,pos)
          join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
          where k.pos<=i.indnkeyatts and a.attname='price'))
  ) then
    raise exception 'Review existing name-only uniqueness before allowing products at distinct prices';
  end if;
end $$;

alter table public.wishlist_items add column if not exists saved_amount numeric(14,2) default 0;
alter table public.wishlist_items add column if not exists plan_weeks integer;

-- Duplicate legacy records make this fail atomically; they require an explicit review, never deletion here.
create unique index if not exists wishlist_owner_product_price_unique_v1
  on public.wishlist_items (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')), price);

alter table public.wishlist_items enable row level security;
drop policy if exists adg_wishlist_owner_guard_v1 on public.wishlist_items;
create policy adg_wishlist_owner_guard_v1 on public.wishlist_items as restrictive for all to public
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists adg_wishlist_owner_access_v1 on public.wishlist_items;
create policy adg_wishlist_owner_access_v1 on public.wishlist_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.wishlist_items to authenticated;

create or replace function public.save_wishlist_plan_checked_v1(
  p_name text, p_price numeric, p_strategy text,
  p_cooldown_days integer default 7, p_planned_weekly_save numeric default null,
  p_plan_weeks integer default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  product_name text := btrim(p_name);
  product_key text := lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'));
  saved public.wishlist_items%rowtype;
  awarded integer := 0;
  total_xp bigint;
  total_streak bigint;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if product_name is null or length(product_name) < 1 or length(product_name) > 180
    or p_price is null or p_price::text in ('NaN','Infinity','-Infinity') or p_price <= 0 or p_price > 999999999 or round(p_price,2) <> p_price
    or p_strategy is null or p_strategy not in ('wait','microsave')
    or p_cooldown_days is null or p_cooldown_days not between 1 and 365 then
    raise exception 'Invalid product' using errcode = '22023';
  end if;
  if p_strategy = 'microsave' and (p_planned_weekly_save is null
    or p_planned_weekly_save::text in ('NaN','Infinity','-Infinity') or p_planned_weekly_save <= 0
    or p_planned_weekly_save > 999999999 or round(p_planned_weekly_save,2) <> p_planned_weekly_save)
    or p_plan_weeks is not null and (p_strategy <> 'microsave' or p_plan_weeks not between 1 and 520)
    or p_strategy = 'wait' and p_planned_weekly_save is not null then
    raise exception 'Invalid savings plan' using errcode = '22023';
  end if;

  -- Lock the profile first, matching the order used by financial transactions. No balance field is updated.
  select wisdom_xp, streak_count into total_xp, total_streak from public.profiles where id = owner_id for update;
  if not found then raise exception 'Profile missing' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text || product_key || ':' || p_price::text, 0));
  select * into saved from public.wishlist_items
    where user_id = owner_id and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = product_key and price = p_price
    for update;
  if found then
    if coalesce(to_jsonb(saved)->>'decision', to_jsonb(saved)->>'status', 'active') in ('purchased','discarded') then
      raise exception 'Wishlist product is closed' using errcode = '22023';
    end if;
    if p_plan_weeks is not null and p_planned_weekly_save * p_plan_weeks < greatest(0, p_price - coalesce(saved.saved_amount,0)) then
      raise exception 'Contribution does not meet target' using errcode = '22023';
    end if;
    update public.wishlist_items set strategy = (jsonb_populate_record(null::public.wishlist_items, jsonb_build_object('strategy', p_strategy))).strategy,
      hold_until = case when saved.strategy::text <> p_strategy and p_strategy = 'wait' then current_date + p_cooldown_days else hold_until end,
      planned_weekly_save = p_planned_weekly_save, plan_weeks = p_plan_weeks, updated_at = now()
      where id = saved.id and user_id = owner_id returning * into saved;
  else
    if p_plan_weeks is not null and p_planned_weekly_save * p_plan_weeks < p_price then
      raise exception 'Contribution does not meet target' using errcode = '22023';
    end if;
    insert into public.wishlist_items (user_id, name, price, strategy, saved_at, hold_until, planned_weekly_save, plan_weeks, saved_amount)
      values (owner_id, product_name, p_price, (jsonb_populate_record(null::public.wishlist_items, jsonb_build_object('strategy', p_strategy))).strategy, now(), current_date + p_cooldown_days,
        p_planned_weekly_save, p_plan_weeks, 0) returning * into saved;
    awarded := case when p_strategy = 'microsave' then 100 else 50 end;
    update public.profiles set wisdom_xp = coalesce(wisdom_xp,0) + awarded, streak_count = coalesce(streak_count,0) + 1
      where id = owner_id returning wisdom_xp, streak_count into total_xp, total_streak;
  end if;
  return jsonb_build_object('id', saved.id, 'xp_awarded', awarded, 'wisdom_xp', coalesce(total_xp,0), 'streak_count', coalesce(total_streak,0));
end $$;
revoke all on function public.save_wishlist_plan_checked_v1(text,numeric,text,integer,numeric,integer) from public, anon;
grant execute on function public.save_wishlist_plan_checked_v1(text,numeric,text,integer,numeric,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
