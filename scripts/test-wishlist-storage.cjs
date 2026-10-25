// Real PostgreSQL execution in an isolated PGlite instance. Never connects to Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { PGlite } = require(process.env.ADG_PGLITE_MODULE || '@electric-sql/pglite');
const migration = fs.readFileSync('supabase/migrations/202610250001_wishlist_micro_savings.sql','utf8');
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const setup = `
create role authenticated; create role anon; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
create table public.profiles(id uuid primary key,current_balance numeric not null,wisdom_xp integer default 0,streak_count integer default 0);
create table public.goals(id uuid primary key,user_id uuid,current_saved numeric);
create table public.transactions(id uuid primary key,user_id uuid,amount numeric);
create table public.wishlist_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 name text not null,price numeric not null,strategy text not null check(strategy in ('wait','microsave')),
 saved_at timestamptz not null default now(),hold_until date,planned_weekly_save numeric,updated_at timestamptz default now());
alter table public.profiles enable row level security;
create policy profiles_owner on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select,update on public.profiles to authenticated;
insert into public.profiles(id,current_balance) values('${A}',3000),('${B}',9000);
insert into public.goals values(gen_random_uuid(),'${A}',1000);
insert into public.wishlist_items(user_id,name,price,strategy) values('${A}','Legacy item',80,'wait');
`;
let checks=0; const results=[]; let postgresVersion;
function check(name,fn) { fn(); checks++; results.push({ name, passed:true }); console.log(`PASS ${name}`); }
async function rejects(name,fn,code) { await assert.rejects(fn,error => error.code === code); checks++; results.push({ name, passed:true }); console.log(`PASS ${name}`); }
async function run() {
  const db = new PGlite();
  try {
    postgresVersion = (await db.query("select current_setting('server_version') as version")).rows[0].version;
    await db.exec(setup); await db.exec(migration);
    const q = async (sql,args=[]) => (await db.query(sql,args)).rows;
    const originalGoals = await q('select * from public.goals');
    let rows=await q("select * from public.wishlist_items where name='Legacy item'");
    check('incremental columns preserve original records',() => { assert.equal(rows.length,1); assert.equal(Number(rows[0].saved_amount),0); assert.equal(rows[0].plan_weeks,null); });
    const role = async owner => db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${owner}';`);
    const save = async (name='Tenis',price=1800,strategy='microsave',weekly=300,weeks=6) =>
      (await q('select public.save_wishlist_plan_checked_v1($1,$2,$3,7,$4,$5) as result',[name,price,strategy,weekly,weeks]))[0].result;
    await role(A);
    const first = await save();
    rows=await q('select * from public.wishlist_items where id=$1',[first.id]);
    check('real SQL persists the configured micro-saving plan',() => { assert.equal(rows[0].strategy,'microsave'); assert.equal(Number(rows[0].planned_weekly_save),300); assert.equal(rows[0].plan_weeks,6); assert.equal(Number(rows[0].saved_amount),0); });
    check('XP awarded only on first insertion',() => assert.equal(first.xp_awarded,100));
    const repeats = await Promise.all([save(),save()]);
    check('repeated confirmations reuse a single product and do not repeat XP',() => { assert.ok(repeats.every(row => row.id===first.id && row.xp_awarded===0)); });
    rows=await q("select * from public.wishlist_items where name='Tenis'");
    check('database contains one plan after duplicate saves',() => assert.equal(rows.length,1));
    const savedAt=rows[0].saved_at;
    await q('update public.wishlist_items set saved_amount=300 where id=$1',[first.id]);
    const edited=await save('  TENIS  ',1800,'microsave',125,12);
    rows=await q('select * from public.wishlist_items where id=$1',[first.id]);
    check('editing uses remaining product savings without touching the amount already saved',() => { assert.equal(edited.id,first.id); assert.equal(Number(rows[0].saved_amount),300); assert.equal(rows[0].plan_weeks,12); assert.equal(Number(rows[0].planned_weekly_save),125); assert.deepEqual(rows[0].saved_at,savedAt); });
    await rejects('an impossible configured deadline is rejected',() => save('Tenis',1800,'microsave',1,6),'22023');
    await rejects('non-cent prices are rejected',() => save('Invalid',1.001),'22023');
    await rejects('non-positive contributions are rejected',() => save('Invalid',1800,'microsave',0,6),'22023');
    await rejects('NaN monetary values are rejected',() => save('Invalid','NaN'),'22023');
    const second=await save('Tenis',2000,'wait',null,null);
    check('same name at a different price is a separate product',() => assert.notEqual(second.id,first.id));
    check('waiting retains its independent strategy',() => assert.equal(second.xp_awarded,50));
    const converted=await save('Tenis',2000,'microsave',200,10);
    check('waiting product can become micro-saving without duplicate record or XP',() => { assert.equal(converted.id,second.id); assert.equal(converted.xp_awarded,0); });
    await rejects('direct duplicate inserts are blocked by the unique index',() => q("insert into public.wishlist_items(user_id,name,price,strategy) values($1,'Tenis',1800,'microsave')",[A]),'23505');
    await role(B);
    rows=await q('select * from public.wishlist_items where user_id=$1',[A]);
    check('RLS hides the other account plans',() => assert.equal(rows.length,0));
    await rejects('RLS rejects inserting for another account',() => q("insert into public.wishlist_items(user_id,name,price,strategy) values($1,'Foreign',1,'wait')",[A]),'42501');
    const own=await save();
    check('another account can save its own independent plan',() => assert.notEqual(own.id,first.id));
    rows=await q('update public.wishlist_items set planned_weekly_save=1 where id=$1 returning id',[first.id]);
    check('RLS prevents changing a foreign plan',() => assert.equal(rows.length,0));
    await db.exec("reset role; set role anon; set request.jwt.claim.sub='';");
    await rejects('anonymous users cannot execute the save RPC',() => save(),'42501');
    await db.exec('reset role;');
    rows=await q('select current_balance from public.profiles order by id');
    check('saving and editing never debit account balances',() => assert.deepEqual(rows.map(row => Number(row.current_balance)),[3000,9000]));
    rows=await q('select * from public.goals');
    check('other goal savings remain exactly unchanged',() => assert.deepEqual(rows,originalGoals));
    rows=await q('select * from public.transactions');
    check('creating a plan never creates an expense',() => assert.equal(rows.length,0));
    await db.exec('alter table public.wishlist_items add column decision text;');
    await q("update public.wishlist_items set decision='purchased' where id=$1",[first.id]);
    await role(A);
    await rejects('closed products cannot be silently reopened as new plans',() => save(),'22023');
    await db.exec('reset role;');
    await db.exec(migration);
    rows=await q('select id from public.wishlist_items where id=$1',[first.id]);
    check('migration can be reapplied without losing plans',() => assert.equal(rows.length,1));
  } finally { await db.close(); }
  const legacy = new PGlite();
  try {
    await legacy.exec(setup);
    await legacy.exec(`insert into public.wishlist_items(user_id,name,price,strategy) values('${A}',' Legacy   item ',80,'wait');`);
    await rejects('duplicate legacy rows stop migration without being removed',() => legacy.exec(migration),'23505');
    await legacy.exec('rollback');
    const rows=(await legacy.query('select * from public.wishlist_items')).rows;
    check('failed migration preserves both original rows',() => assert.equal(rows.length,2));
  } finally { await legacy.close(); }
  const constrained = new PGlite();
  try {
    await constrained.exec(setup);
    await constrained.exec('create unique index legacy_owner_name_only on public.wishlist_items(user_id,name);');
    await rejects('name-only legacy uniqueness must be reviewed before migration',() => constrained.exec(migration),'P0001');
    await constrained.exec('rollback');
    const rows=(await constrained.query('select * from public.wishlist_items')).rows;
    check('legacy uniqueness review preserves existing products',() => assert.equal(rows.length,1));
  } finally { await constrained.close(); }
  fs.writeFileSync('docs/wishlist-storage-test-results.json', JSON.stringify({ evaluatedAt:new Date().toISOString(), engine:'PGlite PostgreSQL', postgresVersion, syntheticDataOnly:true, supabaseRead:false, supabaseWrites:false, migrationSHA256:createHash('sha256').update(migration).digest('hex'), checks, passed:checks, results },null,2)+'\n');
  console.log(`Wishlist PostgreSQL: ${checks}/${checks} checks passed. Synthetic, local only; deployed schema and RLS remain unaudited.`);
}
run().catch(error => { console.error('Local PostgreSQL validation failed:',error.code ?? error.name,error.message); process.exitCode=1; });
