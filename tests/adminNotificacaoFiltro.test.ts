import { describe, expect, it } from 'bun:test';
import { notificacaoBloqueada } from '../supabase/functions/_shared/admin-notificacao-filtro';

describe('Filtro de tipos de aviso do admin', () => {
  it('bloqueia o relatório de freio de qualidade quando ele está na lista negra', () => {
    const cfg = { tipos_permitidos: null, tipos_bloqueados: ['meta_freio_qualidade'] };
    expect(notificacaoBloqueada(cfg, 'meta_freio_qualidade')).toBe(true);
  });
  it('mantém os demais avisos quando só o freio está bloqueado', () => {
    const cfg = { tipos_permitidos: null, tipos_bloqueados: ['meta_freio_qualidade'] };
    expect(notificacaoBloqueada(cfg, 'meta_queda_qualidade')).toBe(false);
    expect(notificacaoBloqueada(cfg, 'resumo_diario')).toBe(false);
  });
  it('lista negra vence a lista branca', () => {
    const cfg = { tipos_permitidos: ['meta_freio_qualidade', 'resumo_diario'], tipos_bloqueados: ['meta_freio_qualidade'] };
    expect(notificacaoBloqueada(cfg, 'meta_freio_qualidade')).toBe(true);
    expect(notificacaoBloqueada(cfg, 'resumo_diario')).toBe(false);
  });
  it('lista branca continua escondendo o que não está nela', () => {
    const cfg = { tipos_permitidos: ['resumo_diario'], tipos_bloqueados: null };
    expect(notificacaoBloqueada(cfg, 'meta_freio_qualidade')).toBe(true);
    expect(notificacaoBloqueada(cfg, 'resumo_diario')).toBe(false);
  });
  it('sem listas configuradas, nada é bloqueado', () => {
    expect(notificacaoBloqueada({ tipos_permitidos: null, tipos_bloqueados: null }, 'meta_freio_qualidade')).toBe(false);
    expect(notificacaoBloqueada({ tipos_permitidos: [], tipos_bloqueados: [] }, 'meta_freio_qualidade')).toBe(false);
    expect(notificacaoBloqueada(null, 'meta_freio_qualidade')).toBe(false);
  });
});
