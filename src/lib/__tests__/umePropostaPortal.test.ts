import { describe, it, expect } from 'vitest';
import { lerPropostaPortal } from '../umePropostaPortal';
const base = 'Olá! Meu nome é Gleuciany, CPF 02190688280. Quero negociar meu débito com UME. Total: R$ 2.092,20. 10 parcelas: R$ 209,22 cada. Primeiro pagamento: 30/10/2026.';
describe('credor da proposta', () => {
  it('UME', () => expect(lerPropostaPortal(base)?.credor).toBe('ume_novo_mundo'));
  it('Odres', () => expect(lerPropostaPortal(base.replace('UME', 'Odres Cred'))?.credor).toBe('odres_cred'));
  it('sem credor', () => expect(lerPropostaPortal(base.replace(' com UME', ''))?.credor).toBeNull());
});
