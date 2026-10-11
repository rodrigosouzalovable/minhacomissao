import { afterAll, beforeAll, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const owner = '00000000-0000-0000-0000-000000000001';
const master = '00000000-0000-0000-0000-000000000002';
const bm = '00000000-0000-0000-0000-000000000003';
const first = '00000000-0000-0000-0000-000000000004';
const second = '00000000-0000-0000-0000-000000000005';
const other = '00000000-0000-0000-0000-000000000006';
type Claim = { allowed: boolean; token?: string; next_allowed_at: string; existing?: boolean };
async function claim(instance: string) {
  const result = await db.query<{ result: Claim }>(
    'SELECT public.claim_meta_template_pacing($1::uuid,$2::uuid) AS result', [instance, master],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Missing claim');
  return row.result;
}
async function reset() {
  await db.exec('TRUNCATE public.meta_template_pacing, public.meta_templates_instancia');
}
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.meta_whatsapp_instances(id uuid PRIMARY KEY,user_id uuid,waba_id text,meta_bm_id uuid,business_id text);
    CREATE TABLE public.meta_templates_mestre(id uuid PRIMARY KEY,criado_por uuid);
    CREATE TABLE public.meta_templates_instancia(instancia_id uuid,template_mestre_id uuid,status text);
    CREATE TABLE public.meta_template_pacing(scope_key text PRIMARY KEY,next_allowed_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,updated_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO public.meta_templates_mestre VALUES('${master}','${owner}');
    INSERT INTO public.meta_whatsapp_instances VALUES
      ('${first}','${owner}','waba-a','${bm}','business-a'),
      ('${second}','${owner}','waba-b','${bm}','business-a'),
      ('${other}','${owner}','waba-c','00000000-0000-0000-0000-000000000007','business-b');
  `);
  await db.exec(readFileSync(new URL('../drizzle/migrations/0177_meta_template_bm_cooldown.sql', import.meta.url), 'utf8'));
  const original = readFileSync(new URL('../drizzle/migrations/0176_atomic_meta_template_pacing.sql', import.meta.url), 'utf8');
  const finish = original.slice(original.indexOf('CREATE OR REPLACE FUNCTION public.finish_meta_template_pacing'), original.indexOf('REVOKE ALL ON FUNCTION public.finish_meta_template_pacing'));
  await db.exec(finish);
});
afterAll(async () => { await db.close(); });

test('the whole BM receives the same randomized 120–300 second cooldown as number and WABA', async () => {
  await reset();
  expect((await claim(first)).allowed).toBe(true);
  const { rows } = await db.query<{ seconds: number; deadlines: number; scopes: number }>(`
    SELECT extract(epoch FROM max(next_allowed_at)-min(updated_at))::float8 AS seconds,
      count(DISTINCT next_allowed_at)::int AS deadlines,count(*)::int AS scopes FROM public.meta_template_pacing
  `);
  expect(rows[0]?.seconds).toBeGreaterThanOrEqual(120);
  expect(rows[0]?.seconds).toBeLessThanOrEqual(300);
  expect(rows[0]?.deadlines).toBe(1);
  expect(rows[0]?.scopes).toBe(3);
});
test('finishing a submission cannot immediately release a different number/WABA of the same BM', async () => {
  await reset();
  const granted = await claim(first);
  await db.query('SELECT public.finish_meta_template_pacing($1::uuid)', [granted.token]);
  const blocked = await claim(second);
  expect(blocked.allowed).toBe(false);
  expect(blocked.next_allowed_at).toBe(granted.next_allowed_at);
});
test('an expired BM lease does not bypass the remaining BM cooldown', async () => {
  await reset();
  await claim(first);
  await db.exec("UPDATE public.meta_template_pacing SET lease_until=now()-interval '1 second'");
  expect((await claim(second)).allowed).toBe(false);
});
test('separate BMs can proceed independently', async () => {
  await reset();
  expect((await claim(first)).allowed).toBe(true);
  expect((await claim(other)).allowed).toBe(true);
});
test('the next number can proceed after the BM cooldown and lease expire', async () => {
  await reset();
  await claim(first);
  await db.exec("UPDATE public.meta_template_pacing SET next_allowed_at=now()-interval '1 second',lease_until=null,lease_token=null");
  expect((await claim(second)).allowed).toBe(true);
});