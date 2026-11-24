import { describe, expect, it } from 'bun:test';
import { estadoAtendimentoIcred, FOLDER_ICRED_INBOX } from '../supabase/functions/_shared/icred-atendimento';

describe('iCred preparado sem ativar', () => {
  it('mantém as respostas automáticas desativadas conforme a autorização', () => {
    expect(estadoAtendimentoIcred(FOLDER_ICRED_INBOX)).toEqual({
      preparado: true, ativo: false, motivo: 'icred_preparado_sem_ativacao',
    });
  });
  it('não modifica o atendimento das outras caixas', () => {
    for (const folder of [null, undefined, 'c0b2a7e1-5d3f-4a8b-9c11-2e6f8d4b7a90', '9267b296-24e6-425d-9f0e-0e4114c782d9']) {
      expect(estadoAtendimentoIcred(folder)).toBeNull();
    }
  });
});