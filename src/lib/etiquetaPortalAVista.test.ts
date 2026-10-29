import { describe, it, expect } from 'vitest';
import { ehAcordoPortalAVista } from '../../supabase/functions/_shared/etiqueta-portal-avista';

const obs = 'Acordo fechado pelo cliente no portal (UME) — PRD';
describe('etiqueta Rodrigo para acordo à vista do portal', () => {
  it('à vista do portal recebe', () => expect(ehAcordoPortalAVista({ parcelas: 1, observacoes: obs })).toBe(true));
  it('parcelado do portal não recebe', () => expect(ehAcordoPortalAVista({ parcelas: 3, observacoes: obs })).toBe(false));
  it('à vista fora do portal não recebe', () => expect(ehAcordoPortalAVista({ parcelas: 1, observacoes: 'Acordo manual' })).toBe(false));
});
