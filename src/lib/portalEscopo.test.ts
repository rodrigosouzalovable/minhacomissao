import { describe, it, expect } from 'vitest';
import { portalEscopo, CREDORES_CONSULTA } from './portalEscopo';

describe('consulta de CPF', () => {
  it('consulta as três carteiras em qualquer portal', () => {
    expect(CREDORES_CONSULTA).toEqual(['novo_mundo', 'ume', 'odres_cred']);
  });
});

describe('portalEscopo', () => {
  it('odrescred mostra somente Odres Cred', () => {
    expect(portalEscopo('odrescred').credores).toEqual(['odres_cred']);
    expect(portalEscopo('odres_cred').credores).toEqual(['odres_cred']);
  });
  it('portal principal nunca inclui Odres Cred', () => {
    for (const s of ['novomundo', 'ume', undefined]) expect(portalEscopo(s).credores).toEqual(['novo_mundo', 'ume']);
  });
});
