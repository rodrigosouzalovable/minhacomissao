import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/apollo';

const Body = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('buscar'),
    cargos: z.array(z.string().min(1).max(100)).min(1).max(15),
    locais: z.array(z.string().min(1).max(100)).max(10).default(['Brazil']),
    palavras_chave: z.string().max(200).optional(),
    portes: z.array(z.string().regex(/^\d+,\d+$/)).max(8).optional(),
    pagina: z.number().int().min(1).max(50).default(1),
    por_pagina: z.number().int().min(1).max(100).default(25),
  }),
  z.object({
    acao: z.literal('revelar'),
    lead_ids: z.array(z.string().uuid()).min(1).max(10),
  }),
]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function apollo(path: string, body: unknown) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  if (!LOVABLE_API_KEY || !APOLLO_API_KEY) throw new Error('Conexão com o Apollo não configurada');
  const r = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': APOLLO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    console.error(`Apollo ${path} [${r.status}]: ${text}`);
    const err = new Error(`Apollo [${r.status}]: ${text.slice(0, 500)}`) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Apenas administradores' }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;

    if (b.acao === 'buscar') {
      const payload: Record<string, unknown> = {
        person_titles: b.cargos,
        person_locations: b.locais,
        page: b.pagina,
        per_page: b.por_pagina,
      };
      if (b.palavras_chave) payload.q_keywords = b.palavras_chave;
      if (b.portes?.length) payload.organization_num_employees_ranges = b.portes;
      const res = await apollo('/api/v1/mixed_people/api_search', payload);
      const pessoas = (res.people ?? []) as any[];
      const rows = pessoas.map((p) => ({
        owner_id: u.user.id,
        apollo_person_id: String(p.id),
        nome: p.first_name ?? null,
        sobrenome: p.last_name ?? p.last_name_obfuscated ?? null,
        cargo: p.title ?? null,
        empresa: p.organization?.name ?? null,
        empresa_dominio: p.organization?.primary_domain ?? p.organization?.website_url ?? null,
        segmento: p.organization?.industry ?? null,
        cidade: [p.city, p.state].filter(Boolean).join(' / ') || null,
        linkedin_url: p.linkedin_url ?? null,
      }));
      let novos = 0;
      if (rows.length) {
        const ids = rows.map((r) => r.apollo_person_id);
        const { data: existentes } = await admin
          .from('prospeccao_b2b_leads').select('apollo_person_id')
          .eq('owner_id', u.user.id).in('apollo_person_id', ids);
        const ja = new Set((existentes ?? []).map((e) => e.apollo_person_id));
        const ins = rows.filter((r) => !ja.has(r.apollo_person_id));
        novos = ins.length;
        if (ins.length) {
          const { error } = await admin.from('prospeccao_b2b_leads').insert(ins);
          if (error) throw error;
        }
      }
      return json({ encontrados: rows.length, novos, total: res.total_entries ?? res.pagination?.total_entries ?? null });
    }

    // revelar
    const { data: leads, error } = await admin
      .from('prospeccao_b2b_leads').select('*')
      .eq('owner_id', u.user.id).in('id', b.lead_ids);
    if (error) throw error;
    const pend = (leads ?? []).filter((l) => !l.revelado);
    if (!pend.length) return json({ revelados: 0 });
    const res = await apollo('/api/v1/people/bulk_match', {
      reveal_personal_emails: false,
      details: pend.map((l) => ({
        id: l.apollo_person_id,
        first_name: l.nome ?? undefined,
        organization_name: l.empresa ?? undefined,
        domain: l.empresa_dominio ?? undefined,
        linkedin_url: l.linkedin_url ?? undefined,
      })),
    });
    const matches = (res.matches ?? []) as any[];
    let revelados = 0;
    for (const m of matches) {
      if (!m) continue;
      const lead = pend.find((l) => l.apollo_person_id === String(m.id)) ?? pend.find((l) => l.linkedin_url && l.linkedin_url === m.linkedin_url);
      if (!lead) continue;
      const tel = m.phone_numbers?.[0]?.sanitized_number ?? m.organization?.phone ?? null;
      await admin.from('prospeccao_b2b_leads').update({
        nome: m.first_name ?? lead.nome,
        sobrenome: m.last_name ?? lead.sobrenome,
        cargo: m.title ?? lead.cargo,
        empresa: m.organization?.name ?? lead.empresa,
        empresa_dominio: m.organization?.primary_domain ?? lead.empresa_dominio,
        segmento: m.organization?.industry ?? lead.segmento,
        linkedin_url: m.linkedin_url ?? lead.linkedin_url,
        email: m.email ?? null,
        email_status: m.email_status ?? null,
        telefone: tel,
        revelado: true,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);
      revelados++;
    }
    // marcar não encontrados como revelados para não gastar créditos de novo
    const achados = new Set(matches.filter(Boolean).map((m) => String(m.id)));
    const semMatch = pend.filter((l) => !achados.has(l.apollo_person_id)).map((l) => l.id);
    if (semMatch.length) {
      await admin.from('prospeccao_b2b_leads').update({ revelado: true, email_status: 'nao_encontrado' }).in('id', semMatch);
    }
    return json({ revelados, sem_dados: semMatch.length });
  } catch (e) {
    const err = e as Error & { status?: number };
    return json({ error: err.message }, err.status && err.status < 500 ? err.status : 500);
  }
});
