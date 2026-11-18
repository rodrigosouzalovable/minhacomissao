import { describe, it, expect } from 'vitest';
import { ehEtiquetaAtendente } from './etiquetaAtendente';
describe('ehEtiquetaAtendente', () => {
  it('detecta etiqueta de atendente', () => expect(ehEtiquetaAtendente('Atendente: Wesley Amaral')).toBe(true));
  it('mantém etiquetas comuns', () => expect(ehEtiquetaAtendente('Interessado')).toBe(false));
});
