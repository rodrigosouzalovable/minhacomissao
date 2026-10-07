import { describe, expect, it } from 'bun:test';
import { atenderRespostaCadastral } from '../supabase/functions/_shared/recuperacao-cadastral-resposta';

function fixture() {
  const state = { claim: false, saida: false, tipo: null as string | null, sends: [] as string[] };
  const db: any = {
    from: (table: string) => {
      const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, neq: () => q,
        update: (patch: any) => { if (table === 'meta_recuperacao_log' && patch.resposta_tipo) state.tipo = patch.resposta_tipo; return q; },
        maybeSingle: async () => ({ data: { id: 'log', status: 'enviado', agradecimento_claim_em: state.claim ? 'claimed' : null, resposta_tipo: state.tipo }, error: null }),
        then: (ok: any) => Promise.resolve({ error: null }).then(ok) };
      return q;
    },
    rpc: async (fn: string) => {
      if (fn === 'blacklist_saida_cadastral') { state.saida = true; state.tipo = 'saida'; return { error: null }; }
      if (fn === 'claim_agradecimento_cadastral') {
        const claimed = !state.claim && !state.saida && state.tipo !== 'negativa';
        if (claimed) state.claim = true;
        return { data: claimed, error: null };
      }
      throw Error('RPC inesperada');
    },
  };
  const contato = { id: 'ct', instancia_id: 'inst', telefone: '5562999999999', origem_aquecimento: 'recuperacao_cadastral' };
  const enviar = async (_db: any, _ct: any, msg: string) => { state.sends.push(msg); return { mensagemId: 'sent', destinatarioInvalido: false }; };
  return { state, run: (t: string, tipo = 'text') => atenderRespostaCadastral(db, contato, t, tipo, enviar) };
}

describe('IAGO cadastral sem envios externos', () => {
  it('uma única resposta exata em confirmações concorrentes e posteriores', async () => {
    const f = fixture();
    await Promise.all([f.run('SIM, CONFIRMO.', 'button'), f.run('sim'), f.run('confirmo')]);
    await f.run('sim'); await f.run('Quero saber mais');
    expect(f.state.sends).toEqual(['Obrigado pela confirmação']);
  });
  it('outras respostas não enviam nada', async () => {
    const f = fixture(); for (const t of ['Olá', 'Somos uma resposta automática', 'Qual o motivo?', 'NÃO']) await f.run(t);
    await f.run('sim'); expect(f.state.sends).toEqual([]);
  });
  it('Sair bloqueia e não agradece nem atende a próxima mensagem', async () => {
    const f = fixture(); await f.run('SAIR', 'interactive'); await f.run('sim');
    expect(f.state.saida).toBe(true); expect(f.state.sends).toEqual([]);
  });
  it('áudio não pode ser confirmação', async () => {
    const f = fixture(); await f.run('sim', 'audio'); expect(f.state.sends).toEqual([]);
  });
  it('falha ambígua não libera outra resposta', async () => {
    const f = fixture();
    const db: any = { from: () => { const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q,
      update: () => q, maybeSingle: async () => ({ data: { id: 'log', status: 'enviado', agradecimento_claim_em: f.state.claim ? 'yes' : null } }), then: (ok: any) => Promise.resolve({}).then(ok) }; return q; },
      rpc: async () => { const data = !f.state.claim; f.state.claim = true; return { data }; } };
    const ct = { id: 'ct', instancia_id: 'i', telefone: '5562999999999', origem_aquecimento: 'recuperacao_cadastral' };
    let attempts = 0;
    const send = async () => { attempts++; throw Error('timeout'); };
    await atenderRespostaCadastral(db, ct, 'sim', 'text', send);
    await atenderRespostaCadastral(db, ct, 'sim', 'text', send);
    expect(attempts).toBe(1);
  });
});