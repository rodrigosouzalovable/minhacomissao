# Chamadas via API oficial: situação atual e ativação em massa

## O que eu verifiquei agora

Consultei as configurações reais do número **Novo Mundo 3144** (892959203899506) na Graph API v23.0 pelo backend. A resposta foi:

```text
calling: { status: "NOT_SET", call_icon_visibility: "NOT_SET", callback_permission_status: "NOT_SET" }
```

Duas conclusões concretas:

1. **O erro anterior acabou.** Antes a Meta respondia `#141000 – not a valid Cloud API number`. Agora o endpoint de configurações responde normalmente — ou seja, ativar a função "calls" no aplicativo destravou o recurso no app.
2. **As chamadas ainda não estão ligadas em nenhum número.** `status: NOT_SET` significa que o recurso existe no app, mas não foi habilitado no número. No banco, todas as 21 instâncias Meta estão com `chamadas_habilitadas = false`.

O que você ativou no painel (`calls` = Assinado) foi a **assinatura do webhook de chamadas** — necessária para receber eventos de chamada, mas não é o que liga o discador no número.

**A boa notícia:** ligar o recurso no número **não precisa de aprovação da Meta nem de configuração manual número por número**. É uma chamada de API (`POST /{phone_number_id}/settings` com `calling.status = ENABLED`) que já está implementada na função `meta-call-settings`. Dá para rodar em todos os números de uma vez.

## O que será feito

1. **Botão "Ativar chamadas em todos os números"** na aba API Oficial Meta (topo da lista de instâncias): percorre todas as instâncias Meta, liga o Calling em cada uma via API e mostra um resumo (quantas ativadas, quais falharam e por quê).
2. **Ler o status real ao abrir a aba**: cada card passa a exibir se as chamadas estão `ENABLED`, `DISABLED` ou `NOT_SET` conforme a Meta responde, em vez de confiar só no valor salvo no banco.
3. **Manter o toggle individual** já existente para ligar/desligar um número específico.
4. **Teste ponta a ponta** depois da ativação: pedido de permissão + ligação de saída no Novo Mundo 3144 para o seu número, lendo a resposta real da Meta e ajustando as mensagens de erro se aparecer algo novo.

## Detalhes técnicos

- `supabase/functions/meta-call-settings/index.ts`: aceita lista de `instancia_ids` (ou `todas: true`) para ativação em lote, com delay curto entre chamadas e retorno item a item.
- `src/pages/ConfigurarMeta.tsx` (aba API Oficial Meta): botão de ativação em massa + leitura do status de calling por instância, gravando em `meta_whatsapp_instances.chamadas_habilitadas`.
- Nenhuma tabela nova, nenhum cron, nenhum polling ou canal Realtime novo — custo de backend inalterado.
