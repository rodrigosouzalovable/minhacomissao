# Selo de qualidade e seleção só GREEN no "Aplicar em lote"

## Objetivo
Na aba **Templates Meta → Aplicar em lote**, mostrar a qualidade de cada instância ao lado do nome e fazer com que a opção "todas as instâncias" selecione apenas as que estão com qualidade **GREEN**. YELLOW e RED ficam desmarcadas.

## O que já existe (confirmado)
- A lista de instâncias do "Aplicar em lote" está em `src/pages/MetaTemplates.tsx`, já filtrada para `provider='meta'`, sem instâncias de parceiros e com busca por nome/número.
- A qualidade já é gravada pelo monitoramento de saúde na coluna `saude_quality` de `meta_whatsapp_instances` (valores GREEN / YELLOW / RED).

## Mudanças (somente `src/pages/MetaTemplates.tsx`)
1. **Buscar a qualidade**: incluir `saude_quality` no select das instâncias e na interface `Instancia`.
2. **Selo de qualidade por linha**: ao lado de cada instância, selo colorido:
   - GREEN → verde
   - YELLOW → amarelo
   - RED ou sem leitura → vermelho/cinza com texto da situação
3. **"Selecionar todos" só GREEN**: o checkbox "Todas as instâncias" passa a marcar/desmarcar apenas as instâncias com qualidade GREEN; YELLOW/RED nunca entram pela seleção em massa. O rótulo passa a indicar isso (ex.: "Todas as X instâncias GREEN").
4. **Proteção no envio**: instâncias YELLOW/RED não marcadas individualmente não recebem o template, mesmo que estejam na lista visível.

## Impacto
- Sem alteração de banco, Edge Functions, cron ou Realtime — sem custo adicional.
- Comportamento manual continua possível: se o usuário quiser, ainda pode marcar uma instância YELLOW/RED individualmente (fica visível pelo selo).

## Verificação
- Build sem erros.
- Conferir no preview: selos de qualidade aparecem e "selecionar todas" marca só as GREEN.
