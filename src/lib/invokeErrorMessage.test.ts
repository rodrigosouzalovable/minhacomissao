import { describe, expect, it } from 'vitest';
import { invokeErrorMessage } from './invokeErrorMessage';

const failure = (body: string, status = 404) => Object.assign(
  new Error('Edge Function returned a non-2xx status code'),
  { context: new Response(body, { status }) },
);

describe('send refusal details', () => {
  it('preserves the inactive sender refusal and original response', async () => {
    const error = failure(JSON.stringify({ success: false, error: 'Instância Meta não encontrada/ativa' }));
    expect(await invokeErrorMessage(error)).toBe('Instância Meta não encontrada/ativa');
    expect(error.context.bodyUsed).toBe(false);
  });
  it('preserves permission refusals without retrying', async () => {
    expect(await invokeErrorMessage(failure(JSON.stringify({ error: 'Você não faz parte da caixa desta conversa e não pode responder por ela' }), 403)))
      .toBe('Você não faz parte da caixa desta conversa e não pode responder por ela');
  });
  it('handles a gateway message', async () => {
    expect(await invokeErrorMessage(failure('{"message":"Sessão inválida ou expirada"}', 401))).toBe('Sessão inválida ou expirada');
  });
  it('falls back for malformed or empty responses', async () => {
    for (const body of ['', '<html>erro</html>', '{"error":{}}']) {
      expect(await invokeErrorMessage(failure(body))).toBe('Edge Function returned a non-2xx status code');
    }
    expect(await invokeErrorMessage(new Error('Falha de rede'))).toBe('Falha de rede');
  });
});