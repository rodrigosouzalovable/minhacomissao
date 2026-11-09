// Sincronização diária automática dos arquivos de carga UME (/carga) e Odres (/odres/carga).
// Autorizada somente pelo token dos agendamentos 'sftp-ume-auto-*'. Cada chamada lê uma fatia do
// arquivo mais novo (limite de CPU por execução), grava clientes/parcelas por UPSERT e encadeia a
// próxima fatia. Na última, registra as baixas para confirmação do admin e remove parcelas que sumiram.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import SftpClient from 'npm:ssh2-sftp-client@10';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const PASTAS_AUTO = ['/carga', '/odres/carga'];
const FATIA = 800_000; // bytes por execução
const BLOCO = 800; // lotes pequenos evitam o tempo limite do banco ao gravar parcelas
const BUCKET = 'sftp-ume-tmp';
const tmp = (pasta: string) => `${pasta.replace(/\//g, '_').replace(/^_/, '')}.csv`;

function normalizarPem(bruta: string): string {
  const t = bruta.replace(/\\n/g, '\n').trim();
  const m = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(t);
  if (!m) return t;
  const corpo = m[2].replace(/\s+/g, '');
  return `-----BEGIN ${m[1]}-----\n${corpo.match(/.{1,64}/g)!.join('\n')}\n-----END ${m[1]}-----\n`;
}
const dataBR = (v?: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((v ?? '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const num = (v?: string) => { const s = (v ?? '').trim(); if (!s) return null; const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : null; };
const txt = (v?: string) => ((v ?? '').trim() || null);

// Erros tardios do canal SFTP (fechamento) não podem derrubar a execução em segundo plano.
globalThis.addEventListener('unhandledrejection', (e) => { console.error('rejeição', String(e.reason)); e.preventDefault(); });
globalThis.addEventListener('error', (e) => { console.error('erro', String((e as ErrorEvent).message)); e.preventDefault(); });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const { data: ok } = await db.rpc('sftp_ume_auto_autorizada', { p_token: token });
  let admin = false;
  // Ponte externa (GitHub Actions) que baixa arquivos grandes sem o limite de tempo da função.
  const ponte = Deno.env.get('SFTP_PONTE_TOKEN') ?? '';
  const viaPonte = !ok && ponte.length >= 24 && token === ponte;
  if (viaPonte) admin = true;
  if (!ok && !viaPonte) {
    const { data: u } = await db.auth.getUser(token);
    if (u?.user) { const { data: r } = await db.rpc('has_role', { _user_id: u.user.id, _role: 'admin' }); admin = !!r; }
    if (!admin) return json({ error: 'Não autorizado' }, 401);
  }

  // Arquivos grandes demais para o download dentro do tempo limite: um admin envia o CSV já baixado
  // do SFTP, que segue exatamente o mesmo processamento em fatias da rotina automática.
  const url = new URL(req.url);
  if (url.searchParams.get('acao') === 'enviar_arquivo') {
    const p = url.searchParams.get('pasta') ?? '';
    const arquivo = url.searchParams.get('arquivo') ?? '';
    if (!PASTAS_AUTO.includes(p) || !/^[\w.-]+\.(csv|txt)$/i.test(arquivo)) return json({ error: 'Parâmetros inválidos' }, 400);
    const { data: atual } = await db.from('sftp_ume_auto_progresso').select('arquivo, status').eq('pasta', p).maybeSingle();
    if (url.searchParams.get('verificar') === '1') {
      return json({ ok: true, ja_processado: atual?.arquivo === arquivo && atual?.status === 'concluido' });
    }
    if (atual?.arquivo === arquivo && ['concluido', 'processando'].includes(atual?.status)) {
      return json({ ok: true, msg: 'Arquivo já importado ou em andamento' });
    }
    const dados = new Uint8Array(await req.arrayBuffer());
    if (!dados.length) return json({ error: 'Arquivo vazio' }, 400);
    const { error: eu } = await db.storage.from(BUCKET).upload(tmp(p), new Blob([dados], { type: 'text/csv' }), { upsert: true });
    if (eu) return json({ error: `temporário: ${eu.message}` }, 500);
    await db.from('sftp_ume_auto_progresso').upsert({ pasta: p, arquivo, tamanho: dados.length,
      modificado: Number(url.searchParams.get('modificado') ?? Date.now()), posicao: 0, data_lote: null, carteira: null,
      total_linhas: 0, clientes: 0, parcelas: 0, baixas: [], status: 'processando', erro: null, atualizado_em: new Date().toISOString() });
    const tarefa = encadear(db, p, token);
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil(tarefa);
    return json({ ok: true, recebido: dados.length }, 202);
  }

  const body = await req.json().catch(() => ({}));
  const pasta = PASTAS_AUTO.includes(body?.pasta) ? body.pasta as string : null;
  if (!pasta) return json({ error: 'Pasta inválida' }, 400);
  const continuar = body?.continuar === true;

  if (admin && !continuar) return json({ error: 'Admins só podem enviar arquivo ou continuar' }, 400);
  const tarefa = fatia(db, pasta, continuar).then((r) => proxima(r, pasta, token));
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(tarefa);
  return json({ ok: true, iniciado: pasta }, 202);
});

async function proxima(r: Record<string, unknown>, pasta: string, token: string) {
  console.log('sftp-ume-auto', JSON.stringify(r));
  if (!r.proxima) return;
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sftp-ume-auto`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pasta, continuar: true }),
  }).then((x) => x.body?.cancel()).catch((e) => console.error('encadear', e));
}

// deno-lint-ignore no-explicit-any
async function encadear(db: any, pasta: string, token: string) {
  return proxima({ proxima: true, pasta }, pasta, token);
}

// deno-lint-ignore no-explicit-any
async function fatia(db: any, pasta: string, continuar: boolean): Promise<Record<string, unknown>> {
  const { data: cfg } = await db.from('sftp_ume_config').select('private_key').maybeSingle();
  const chave = cfg?.private_key || Deno.env.get('SFTP_UME_PRIVATE_KEY');
  if (!chave) return { erro: 'Chave SFTP ausente' };
  const sftp = new SftpClient();
  // deno-lint-ignore no-explicit-any
  sftp.on('error', (e: any) => console.error('sftp', String(e?.message ?? e)));
  try {
    let { data: st } = await db.from('sftp_ume_auto_progresso').select('*').eq('pasta', pasta).maybeSingle();

    if (!continuar) {
      await sftp.connect({
        host: Deno.env.get('SFTP_UME_HOST') ?? '35.227.83.18', port: 22,
        username: Deno.env.get('SFTP_UME_USER') ?? 'ribeiro_usr', privateKey: normalizarPem(chave), readyTimeout: 20000,
      });
      const itens = (await sftp.list(pasta)).filter((i: any) => i.type === '-' && /\.(csv|txt)$/i.test(i.name))
        .sort((a: any, b: any) => b.modifyTime - a.modifyTime);
      const arq = itens[0];
      if (!arq) return { pasta, msg: 'Nenhum arquivo' };
      // Pula só o que esta rotina já concluiu; um arquivo importado manualmente ainda pode ter
      // ficado sem clientes/parcelas gravados, então é reprocessado (o UPSERT não duplica nada).
      if (st?.arquivo === arq.name && st?.status === 'concluido') return { pasta, arquivo: arq.name, msg: 'Já importado' };
      st = { pasta, arquivo: arq.name, tamanho: arq.size, modificado: arq.modifyTime, posicao: 0, data_lote: null, carteira: null,
        total_linhas: 0, clientes: 0, parcelas: 0, baixas: [], status: 'processando', erro: null, atualizado_em: new Date().toISOString() };
      // O servidor SFTP não permite leitura a partir de um deslocamento: baixa o arquivo inteiro uma vez
      // para um armazenamento privado temporário e processa dali em fatias.
      const partes: Uint8Array[] = [];
      for await (const c of sftp.createReadStream(`${pasta}/${arq.name}`, { highWaterMark: 256 * 1024 }) as AsyncIterable<Uint8Array>) {
        partes.push(new Uint8Array(c));
      }
      console.log('sftp-ume-auto baixado', pasta, partes.length);
      const { error: eu } = await db.storage.from(BUCKET).upload(tmp(pasta), new Blob(partes, { type: 'text/csv' }), { upsert: true });
      if (eu) throw new Error(`temporário: ${eu.message}`);
      st.tamanho = partes.reduce((n, p) => n + p.length, 0);
      await db.from('sftp_ume_auto_progresso').upsert(st);
      return { pasta, arquivo: arq.name, baixado: st.tamanho, proxima: true };
    }
    if (!st || st.status !== 'processando') return { pasta, msg: 'Nada em andamento' };

    const caminho = `${pasta}/${st.arquivo}`;
    const inicio = Number(st.posicao);
    const fim = Math.min(inicio + FATIA, Number(st.tamanho)) - 1;
    const { data: su, error: es } = await db.storage.from(BUCKET).createSignedUrl(tmp(pasta), 120);
    if (es || !su?.signedUrl) throw new Error(`link temporário: ${es?.message}`);
    const rr = await fetch(su.signedUrl, { headers: { Range: `bytes=${inicio}-${fim}` } });
    if (!rr.ok) throw new Error(`leitura temporária: HTTP ${rr.status} ${(await rr.text()).slice(0, 120)}`);
    const buf = new Uint8Array(await rr.arrayBuffer());
    if (rr.status !== 206 && inicio > 0) throw new Error('Armazenamento ignorou a faixa solicitada');
    const ultimo = fim + 1 >= Number(st.tamanho);
    let usar = buf.length;
    if (!ultimo) { const nl = buf.lastIndexOf(10); if (nl < 0) throw new Error('Linha maior que a fatia'); usar = nl + 1; }
    const texto = new TextDecoder('latin1').decode(buf.subarray(0, usar));

    const clientes: unknown[] = [], parcelas: unknown[] = [];
    const baixas: unknown[] = Array.isArray(st.baixas) ? st.baixas : [];
    let { data_lote: dataLote, carteira } = st;
    let linhas = 0;
    for (const bruta of texto.split(/\r?\n/)) {
      if (!bruta) continue;
      linhas++;
      const p = bruta.split(';');
      const cpf = (p[2] ?? '').replace(/\D/g, '');
      if (p[0] === '00') { dataLote = dataBR(p[1]); carteira = txt(p[2]); }
      else if (p[0] === '01') {
        const c = (p[3] ?? '').replace(/\D/g, ''); const id = txt(p[1]);
        if (c && id) clientes.push({ cpf: c.padStart(11, '0'), borrower_id: id, nome: txt(p[4]) });
      } else if (p[0] === '06' && cpf && txt(p[4])) {
        parcelas.push({ installment_id: txt(p[4]), cpf: cpf.padStart(11, '0'), borrower_id: txt(p[1]) ?? '',
          contrato: txt(p[3]), vencimento: dataBR(p[5]), valor: num(p[6]) });
      } else if (p[0] === '08' && cpf) {
        baixas.push({ tipo: '08', cpf, contrato: txt(p[7]), parcela_ref: txt(p[6]), vencimento: dataBR(p[4]),
          valor: num(p[5]), data_pagamento: dataBR(p[8]), valor_pago: num(p[9]) });
      } else if (p[0] === '22' && cpf) {
        baixas.push({ tipo: '22', cpf, contrato: txt(p[3]), parcela_ref: txt(p[5]), vencimento: dataBR(p[6]),
          valor: num(p[7]), data_pagamento: null, valor_pago: num(p[12]) ?? num(p[7]) });
      }
    }
    if (!dataLote || !carteira) throw new Error('Arquivo sem cabeçalho 00');
    // Grava em lotes; em tempo limite, repete o mesmo trecho em pedaços menores (UPSERT é idempotente).
    const gravar = async (cl: unknown[], pa: unknown[], tentativa = 0): Promise<void> => {
      const { error } = await db.rpc('ume_carteira_gravar', { p_carteira: carteira, p_lote: dataLote, p_clientes: cl, p_parcelas: pa });
      if (!error) return;
      if (!/timeout/i.test(error.message) || tentativa >= 4) throw new Error(`gravar: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
      if (cl.length + pa.length <= 50) return gravar(cl, pa, tentativa + 1);
      const mc = Math.ceil(cl.length / 2), mp = Math.ceil(pa.length / 2);
      await gravar(cl.slice(0, mc), pa.slice(0, mp), tentativa + 1);
      await gravar(cl.slice(mc), pa.slice(mp), tentativa + 1);
    };
    for (let i = 0; i < Math.max(clientes.length, parcelas.length); i += BLOCO) {
      await gravar(clientes.slice(i, i + BLOCO), parcelas.slice(i, i + BLOCO));
    }
    const novo = { posicao: inicio + usar, data_lote: dataLote, carteira, total_linhas: st.total_linhas + linhas,
      clientes: st.clientes + clientes.length, parcelas: st.parcelas + parcelas.length, baixas, atualizado_em: new Date().toISOString() };

    if (!ultimo) {
      await db.from('sftp_ume_auto_progresso').update(novo).eq('pasta', pasta);
      return { pasta, posicao: novo.posicao, tamanho: st.tamanho, proxima: true };
    }
    const { data: reg } = await db.from('sftp_ume_arquivos').select('id').eq('nome_arquivo', st.arquivo).maybeSingle();
    let arquivoId: string | null = reg?.id ?? null;
    if (!arquivoId) {
      const { data: novoId, error: er } = await db.rpc('sftp_ume_registrar', {
        p_nome: st.arquivo, p_origem: 'auto', p_data_lote: dataLote,
        p_assinatura: `auto:${caminho}:${st.tamanho}:${st.modificado}`, p_total_linhas: novo.total_linhas, p_baixas: baixas,
      });
      if (er) throw new Error(`registrar: ${er.message}`);
      arquivoId = novoId as string;
    }
    // Baixa automática: parcelas de acordos ativos casadas por CPF, valor e vencimento viram pagas.
    const { data: baixadas, error: ea } = await db.rpc('sftp_ume_aplicar', { p_arquivo: arquivoId });
    if (ea) console.error('sftp-ume-auto aplicar', pasta, ea.message);
    // CPFs com acordo ativo cujo pagamento não casou: baixa a parcela aberta mais próxima ou lança uma nova parcela paga.
    const { data: vinculadas, error: ev } = await db.rpc('sftp_ume_vincular_existentes', { p_arquivo: arquivoId });
    if (ev) console.error('sftp-ume-auto vincular', pasta, ev.message);
    else console.log('sftp-ume-auto vinculadas', pasta, vinculadas);
    const { data: removidas } = await db.rpc('ume_carteira_finalizar', { p_carteira: carteira, p_lote: dataLote });
    await db.from('sftp_ume_auto_progresso').update({ ...novo, baixas: [], status: 'concluido' }).eq('pasta', pasta);
    await db.storage.from(BUCKET).remove([tmp(pasta)]);
    return { pasta, arquivo: st.arquivo, clientes: novo.clientes, parcelas: novo.parcelas, baixas: baixas.length, baixadas, removidas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('sftp-ume-auto', pasta, msg);
    await db.from('sftp_ume_auto_progresso').update({ status: 'erro', erro: msg, atualizado_em: new Date().toISOString() }).eq('pasta', pasta);
    return { pasta, erro: msg };
  } finally {
    await sftp.end().catch(() => {});
  }
}
