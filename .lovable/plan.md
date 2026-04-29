## Objetivo

No diálogo "Nova conversa" do WhatsApp Inbox, listar **apenas as instâncias realmente conectadas** ao WhatsApp (status `connected`/`open`/`online` na UAZAPI), ocultando as desconectadas — mesmo que estejam marcadas como `ativo=true` no banco.

Hoje, o `WhatsAppInbox.tsx` carrega instâncias filtrando só por `ativo=true`, sem checar a conexão real com a UAZAPI, então instâncias desconectadas continuam aparecendo no select do diálogo.

## Mudanças

### 1. `src/pages/WhatsAppInbox.tsx`
- Adicionar um estado `instanciasConectadas: Instancia[]` (ou um `Record<id, 'checking'|'connected'|'disconnected'>`), seguindo o mesmo padrão já usado em `src/pages/CampanhasVoz.tsx` (linhas 167–218).
- Quando o diálogo "Nova conversa" abrir (ou logo após carregar `instancias`), disparar `Promise.allSettled` chamando a edge function `test-uazapi-connection` para cada instância e marcar como conectada apenas quando:
  - `data?.ok === true`, e
  - `status` ∈ `connected | open | online` ou `connected === true`.
- Passar para `<NovaConversaDialog instancias={instanciasConectadas} />` somente as conectadas.
- Indicar carregamento: enquanto verifica, mostrar estado "Verificando instâncias..." dentro do diálogo (prop opcional `loading` ou desabilitar o combobox).
- Re-checar ao reabrir o diálogo (para refletir reconexões/desconexões sem precisar recarregar a página).

### 2. `src/components/inbox/NovaConversaDialog.tsx`
- Aceitar prop opcional `verificandoConexao?: boolean`.
- Quando `verificandoConexao` for true, exibir spinner/legenda "Verificando instâncias conectadas..." no campo Instância e desabilitar o combobox.
- Quando `instancias.length === 0` e não estiver verificando, exibir aviso "Nenhuma instância conectada no momento" e desabilitar o botão "Iniciar conversa".

### Detalhes técnicos
- Reutilizar exatamente a mesma lógica de detecção de status já validada em `CampanhasVoz.tsx` para manter consistência.
- A verificação só roda para o subconjunto que o usuário já tem permissão (a query atual em `fetchInstancias` já respeita `inbox_compartilhado`/`acordos_compartilhados`).
- Sem mudanças de banco e sem mudanças em outras telas — outras partes do Inbox (filtro lateral, envio em conversas existentes) continuam usando todas as instâncias `ativo=true`, pois lá o usuário pode estar visualizando histórico de uma instância temporariamente desconectada.

### Arquivos modificados
- `src/pages/WhatsAppInbox.tsx`
- `src/components/inbox/NovaConversaDialog.tsx`
