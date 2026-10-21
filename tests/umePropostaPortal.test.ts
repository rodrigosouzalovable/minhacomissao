import { describe, it, expect } from 'vitest';
import { lerPropostaPortal, ultimaPropostaPortal } from '../src/lib/umePropostaPortal';

const msg = 'Olá! Meu nome é TATIANA SANTANA DOS SANTOS, CPF 01232275506. Quero negociar meu débito com Odres Cred. Principal: R$ 2.285,00. Acréscimo de 10%: R$ 228,50. Total: R$ 2.513,50. 18 parcelas: R$ 139,63, sendo a última de R$ 139,79. Primeiro pagamento: 31/10/2026. Gostaria de confirmar as condições e solicitar o boleto.';

describe('proposta do portal', () => {
  it('extrai CPF, total, parcelas e 1º vencimento', () => {
    expect(lerPropostaPortal(msg)).toEqual({ cpf: '01232275506', total: 2513.5, parcelas: 18, primeiroVencimento: '2026-10-31' });
  });
  it('à vista vira 1 parcela', () => {
    expect(lerPropostaPortal('CPF 01232275506. Quero negociar meu débito com UME. Total: R$ 2.285,00. À vista: R$ 2.285,00. Primeiro pagamento: 25/10/2026.')?.parcelas).toBe(1);
  });
  it('ignora mensagens que não são proposta e mensagens enviadas pelo atendente', () => {
    expect(lerPropostaPortal('oi, quero pagar')).toBeNull();
    expect(ultimaPropostaPortal([{ conteudo: msg, direcao: 'saida' }])).toBeNull();
  });
});
