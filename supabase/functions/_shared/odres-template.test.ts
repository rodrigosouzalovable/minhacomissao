import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ODRES_TEMPLATE_NOVO, podeUsarNovoTemplateOdres } from './odres-template.ts';

Deno.test('troca Odres começa em 28/11/2026, nunca nas campanhas de hoje', () => {
  assertEquals(podeUsarNovoTemplateOdres('2026-11-27', 30), false);
  assertEquals(podeUsarNovoTemplateOdres('2026-11-28', 3), true);
  assertEquals(podeUsarNovoTemplateOdres('2026-11-30', 3), true);
});

Deno.test('aprovações insuficientes preservam o template anterior', () => {
  assertEquals(podeUsarNovoTemplateOdres('2026-11-28', 0), false);
  assertEquals(podeUsarNovoTemplateOdres('2026-11-28', 2), false);
});

Deno.test('campanha seleciona exatamente o novo modelo informado', () => {
  assertEquals(ODRES_TEMPLATE_NOVO, 'odres_notificacao_desbloqueio_pix_4');
});