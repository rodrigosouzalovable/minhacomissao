import { describe, it, expect } from 'vitest';
import { gerarPromptSite } from './promptSiteLovable';

describe('gerarPromptSite', () => {
  it('usa nome, telefone formatado e WhatsApp do lead', () => {
    const p = gerarPromptSite({ nome: 'RC PAINTING LLC', telefone: '12035129634', cidade: 'Danbury CT', nicho: 'brazilian painting contractor' });
    expect(p).toContain('"RC PAINTING LLC"');
    expect(p).toContain('(203) 512-9634');
    expect(p).toContain('https://wa.me/12035129634');
    expect(p).toContain('a painting contractor serving Danbury CT');
  });
});
