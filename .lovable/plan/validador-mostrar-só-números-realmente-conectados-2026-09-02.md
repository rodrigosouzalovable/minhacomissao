# Validador: mostrar só números realmente conectados

No campo "Validar WhatsApp antes do disparo" (aba Envio Meta), a lista hoje traz todas as instâncias UAZAPI marcadas como ativas no banco — inclusive as desconectadas. O banco não guarda o estado de conexão; ele só é conhecido consultando a UAZAPI. A mudança passa a checar a conexão e listar apenas as conectadas.

## Comportamento

- Ao abrir o seletor pela primeira vez, o sistema checa a conexão das instâncias UAZAPI e exibe apenas as que respondem como conectadas.
- Enquanto checa: item "Verificando números conectados..." no lugar da lista; "Sem validação (envia para todos)" continua sempre disponível.
- Sem nenhuma conectada: mensagem "Nenhum número UAZAPI conectado no momento".
- Se a instância escolhida cair depois, ela sai da lista e a seleção volta para "Sem validação", com aviso.
- Pequeno botão de atualizar ao lado do campo para refazer a checagem ignorando o cache.

## Detalhes técnicos e custo

- Arquivo: `src/pages/EnvioMeta.tsx` apenas.
- Usa `checkUazapiConnection` + `isResultConnected` de `src/lib/uazapiConnectionCache.ts`, que já tem cache de 5 minutos em memória/sessionStorage.
- Impacto de custo: até N invocações de `test-uazapi-connection` (uma por instância ativa) a cada 5 minutos por sessão, e somente quando o usuário abre o seletor — não roda no carregamento da página nem em intervalo automático. Checagens em lotes de 5 em paralelo para não estourar requisições simultâneas. Sem cron, sem polling, sem Realtime novo.
- Nenhuma alteração de banco, RLS ou Edge Function.
