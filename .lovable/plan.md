

## Filtrar WhatsApps conectados nas Campanhas de Voz

### Problema
Atualmente, a lista de WhatsApp para envio na aba Campanhas de Voz mostra todas as instâncias ativas, sem verificar se estão realmente conectadas. O status de conexão não é salvo no banco — é verificado em tempo real via a edge function `test-uazapi-connection`.

### Solução
Adicionar uma verificação de conexão ao carregar as instâncias na página de Campanhas de Voz, igual ao que já é feito na página de Acionamento. Apenas instâncias conectadas serão exibidas na lista de seleção.

### Alterações

**Arquivo: `src/pages/CampanhasVoz.tsx`**

1. Após carregar as instâncias do banco, chamar `test-uazapi-connection` para cada uma (em paralelo) — mesmo padrão usado em `Acionamento.tsx`
2. Filtrar a lista `instances` para exibir apenas as que retornarem `connected === true`
3. Mostrar um indicador de "Verificando conexões..." enquanto o check está em andamento
4. Aplicar o mesmo filtro no segundo ponto onde instâncias aparecem (seção de envio rápido, se existir)

### Detalhes técnicos

- Reutilizar a lógica de `checkInstanceConnections` do `Acionamento.tsx`: invocar `supabase.functions.invoke('test-uazapi-connection', { body: { server_url, instance_token } })` para cada instância
- Guardar o resultado num estado `connectionStatus: Record<string, 'connected' | 'disconnected' | 'checking'>`
- Filtrar `instances` para mostrar apenas `connectionStatus[id] === 'connected'`
- As instâncias em estado `checking` mostram um spinner pequeno

