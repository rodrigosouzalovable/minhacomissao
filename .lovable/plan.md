## Diagnóstico

Na aba Envio Meta Massa, ao selecionar a IPHONE B7, nenhum template aparece porque o carregamento em `EnvioMeta.tsx` (linha 287) filtra `.eq("status", "approved")`. O template `abertura_para_negociacao_de_debito` está aprovado em apenas 1/17 instâncias — se essa instância não for a IPHONE B7, nenhum registro é retornado para ela e o dropdown fica vazio.

## Correção

Arquivo único: `src/pages/EnvioMeta.tsx`.

1. Remover o `.eq("status", "approved")` da query de `meta_whatsapp_templates` (mantendo `.eq("habilitado_envio_massa", true)`). Isso traz todas as instâncias em que o template existe (aprovado, pending, rejected).

2. O agrupamento existente já ignora status ao decidir se aparece na lista, mas conta em `instanciasAprovadasIds` apenas as linhas com `status === "approved"`. Consequência:
   - IPHONE B7 selecionada sem aprovação → template aparece com badge "0/1 instâncias" em vermelho.
   - O aviso amarelo já existente ("Este template não está aprovado em: IPHONE B7 … Remova essas instâncias ou sincronize/aprovar") aparece automaticamente, com o botão de sincronizar as instâncias incompatíveis.
   - O botão "Iniciar envio" já é bloqueado quando há instâncias incompatíveis, então não há risco de disparo com template não aprovado.

3. Sem mudanças em backend, migrations ou outras páginas.

## Fora de escopo

- Alterar o comportamento de sincronização.
- Alterar o botão "Marcar Massa" da aba API Oficial Meta (já toca todas as linhas do template).
