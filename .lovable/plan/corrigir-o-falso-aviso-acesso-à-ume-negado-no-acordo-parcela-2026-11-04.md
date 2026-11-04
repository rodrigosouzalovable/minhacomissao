# Corrigir o falso aviso "acesso à UME negado" no acordo parcelado

## O que foi verificado
- O login com a UME está funcionando hoje: há acordos simulados e efetivados com sucesso pela mesma tela até 16:25 UTC (ex.: 16:04, 16:24, 16:25).
- O CPF 865.105.075-52 está no arquivo SFTP de hoje (04/11), com parcelas — então não é falta de cadastro.
- Esse erro acontece na etapa em que o sistema pede à UME a dívida atualizada antes de simular/efetivar. Quando essa etapa falha, a resposta da UME **não é gravada em lugar nenhum**, por isso não há registro do motivo real.
- O tradutor de erros classifica como "acesso negado" qualquer mensagem que contenha os números `401` ou `403` em qualquer posição. Mensagens da UME trazem números de parcelas/IDs/valores (ex.: "installment 8840312 ..."), então uma recusa comum (parcela já paga, parcela em outro acordo etc.) pode estar sendo exibida como "problema de login".

Diagnóstico mais provável (ainda não confirmado com a resposta bruta): recusa normal da UME para esse cliente, traduzida errado como "acesso negado".

## Correções
1. **Registrar a recusa da etapa de dívida atualizada** no histórico de chamadas UME (mesmo registro já usado para simular/efetivar), para sempre sabermos o motivo real.
2. **Corrigir o tradutor de erros**: "acesso negado" só quando a UME responder de fato com status 401/403 ou com texto de autorização (unauthorized, forbidden, invalid token) — nunca por um número aparecer no meio da mensagem. O mesmo ajuste para "fora do ar" (`5xx` só pelo status).
3. **Mostrar ao atendente a mensagem traduzida certa** (ex.: "A parcela X já foi paga no acordo anterior…") e, se não for reconhecida, um trecho curto do motivo original da UME.
4. Após publicar, reproduzir com o CPF 865.105.075-52 (somente simulação, sem efetivar) e ler o motivo registrado para confirmar a causa.
5. Testes automáticos do tradutor: mensagem com número contendo "403" não vira "acesso negado"; status 401 real vira.

Nada muda nas regras de acordo, limites da UME (30 req/min) ou valores. Sem novo custo de servidor.

## Técnico
- `supabase/functions/ume-acordo-api/index.ts`: no ramo `ume_base`, inserir em `ume_acordo_api_log` com `sucesso:false` e `resposta: base.data` + status; passar `base.status` ao tradutor.
- `supabase/functions/_shared/ume-erros.ts`: `traduzirErroUme(original, contexto, status?)`; remover `401|403|5\d\d` soltos do regex, decidir por `status`; fallback inclui `txt.slice(0,160)`.
- Aplicar o mesmo `status` em `ume-boleto`/outros chamadores de `traduzirErroUme`.
- Teste em `supabase/functions/_shared/ume-erros.test.ts` (ou `src/lib`) com Vitest.
