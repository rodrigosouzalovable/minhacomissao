import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const round2 = (v: number) => Math.round(v * 100) / 100;

const isDataBR = (v: unknown) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(v ?? ''));

function somaDias(dataBR: string, dias: number): string {
  const [d, m, y] = dataBR.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getUTCDate())}/${p(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}

async function chamarRobo(
  cfg: { server_url: string; token: string },
  rota: string,
  payload: Record<string, unknown>,
) {
  const base = cfg.server_url.replace(/\/+$/, '');
  const resp = await fetch(`${base}${rota}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-robo-token': cfg.token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });
  const texto = await resp.text();
  let data: any = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { data = { raw: texto }; }
  if (!resp.ok) {
    throw new Error(data?.error || data?.message || `robô respondeu ${resp.status}`);
  }
  return data ?? {};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const jwt = auth.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'não autenticado' }, 401);
    const { data: userData } = await service.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: 'não autenticado' }, 401);

    const body = await req.json().catch(() => ({} as any));
    const acao = String((body as any)?.acao || '');

    const { data: isAdminData } = await service.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    const isAdmin = isAdminData === true;

    // ── Configuração do robô (só admin) ──────────────────────────────────
    if (acao === 'config_get') {
      if (!isAdmin) return json({ error: 'apenas administradores' }, 403);
      const { data } = await service.from('ume_backoffice_config').select('server_url, ativo, token').limit(1).maybeSingle();
      return json({
        success: true,
        config: data
          ? { server_url: data.server_url ?? '', ativo: !!data.ativo, tem_token: !!data.token }
          : { server_url: '', ativo: false, tem_token: false },
      });
    }

    if (acao === 'config_salvar') {
      if (!isAdmin) return json({ error: 'apenas administradores' }, 403);
      const server_url = String((body as any)?.server_url || '').trim();
      const token = String((body as any)?.token || '').trim();
      const ativo = !!(body as any)?.ativo;
      if (server_url && !/^https?:\/\//i.test(server_url)) return json({ error: 'endereço do robô inválido' }, 400);
      const { data: atual } = await service.from('ume_backoffice_config').select('id, token').limit(1).maybeSingle();
      const registro: Record<string, unknown> = {
        server_url,
        ativo,
        token: token || (atual as any)?.token || null,
        criado_por: user.id,
      };
      if ((atual as any)?.id) {
        const { error } = await service.from('ume_backoffice_config').update(registro).eq('id', (atual as any).id);
        if (error) throw error;
      } else {
        const { error } = await service.from('ume_backoffice_config').insert(registro);
        if (error) throw error;
      }
      return json({ success: true });
    }

    // ── Daqui pra baixo precisa do robô configurado ──────────────────────
    const { data: cfgRow } = await service
      .from('ume_backoffice_config')
      .select('server_url, token, ativo')
      .limit(1)
      .maybeSingle();

    const cfg = cfgRow as { server_url: string | null; token: string | null; ativo: boolean } | null;
    if (!cfg?.ativo || !cfg.server_url || !cfg.token) {
      return json({ success: false, error: 'robo_nao_configurado', message: 'O robô da UME ainda não está configurado/ligado.' }, 200);
    }
    const robo = { server_url: cfg.server_url, token: cfg.token };
    const operadorSlug = String((body as any)?.operador || user.id);

    if (acao === 'sessao_status') {
      const r = await chamarRobo(robo, '/ume/sessao-status', { operador: operadorSlug });
      return json({ success: true, ...r });
    }

    if (acao === 'abrir_login') {
      const r = await chamarRobo(robo, '/ume/login-window', { operador: operadorSlug });
      return json({ success: true, ...r });
    }

    if (acao === 'divida') {
      const cpf = soDigitos((body as any)?.cpf);
      if (cpf.length !== 11) return json({ error: 'CPF inválido' }, 400);
      const r = await chamarRobo(robo, '/ume/divida', { operador: operadorSlug, cpf });
      return json({ success: true, ...r });
    }

    if (acao === 'simular' || acao === 'efetivar') {
      const cpf = soDigitos((body as any)?.cpf);
      const parcelas = Number((body as any)?.parcelas);
      const valorParcela = Number((body as any)?.valorParcela);
      const totalDivida = Number((body as any)?.totalDivida);
      const dataEntrada = String((body as any)?.dataEntrada || '');

      if (cpf.length !== 11) return json({ error: 'CPF inválido' }, 400);
      if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 24) return json({ error: 'número de parcelas deve ser de 1 a 24' }, 400);
      if (!(valorParcela > 0)) return json({ error: 'valor da parcela inválido' }, 400);
      if (!(totalDivida > 0)) return json({ error: 'total da dívida inválido' }, 400);
      if (!isDataBR(dataEntrada)) return json({ error: 'data da entrada deve estar no formato dd/mm/aaaa' }, 400);

      const totalAcordo = round2(valorParcela * parcelas);
      const desconto = round2(totalDivida - totalAcordo);
      if (desconto < 0) return json({ error: 'o acordo ficou maior que a dívida — confira os valores' }, 400);

      const payload = {
        operador: operadorSlug,
        cpf,
        desconto: desconto.toFixed(2),
        entrada: valorParcela.toFixed(2),
        dataEntrada,
        vctoParcela: somaDias(dataEntrada, 30),
        parcelas,
        taxaJuros: '0',
      };

      const r = await chamarRobo(robo, acao === 'simular' ? '/ume/simular' : '/ume/efetivar', payload);

      await service.from('ume_acordo_jobs').insert({
        user_id: user.id,
        cpf,
        telefone: String((body as any)?.telefone || '') || null,
        conversa_id: String((body as any)?.conversaId || '') || null,
        operador_slug: operadorSlug,
        payload: { ...payload, totalDivida, totalAcordo },
        simulacao: acao === 'simular' ? (r ?? null) : null,
        resultado: acao === 'efetivar' ? (r ?? null) : null,
        status: acao === 'simular' ? 'simulado' : 'efetivado',
        screenshot_url: (r as any)?.screenshot ?? null,
      });

      return json({ success: true, acao, calculado: payload, robo: r });
    }

    return json({ error: 'ação inválida' }, 400);
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    console.error('[ume-backoffice-acordo] erro', msg);
    if (msg.includes('layout_ume_mudou')) {
      try {
        await notificarAdmin(service, {
          tipo: 'ume_backoffice_layout_mudou',
          mensagem: '⚠️ *Acordo UME indisponível*\n\nO layout do backoffice da UME mudou. A geração automática de acordos está suspensa até o ajuste.',
        });
      } catch { /* melhor esforço */ }
      return json({ success: false, error: 'layout_ume_mudou', message: 'O layout do backoffice UME mudou. Avisei o administrador.' }, 200);
    }
    return json({ success: false, error: msg }, 200);
  }
});
