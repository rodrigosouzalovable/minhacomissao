## Botão "Reativar Todos os Webhooks"

### Resposta direta

**Sim, é totalmente possível** — e a melhor notícia: **o backend já está 100% pronto** no projeto. Existe uma função na edge `whatsapp-qr` chamada `setupWebhookAll()` que:

1. Busca todas as suas instâncias ativas no banco
2. Para cada uma, faz `POST` no endpoint `/webhook` da UAZAPI (exatamente o que o suporte indicou)
3. Envia o payload com `enabled: true`, evento `messages`, excluindo grupos e broadcast
4. Tenta 3 rotas diferentes (`/webhook/{token}`, `/webhook` com token no header, `/globalwebhook`) para máxima compatibilidade
5. Retorna um relatório `{ total, success, failed, details[] }` com o resultado de cada instância

**Falta apenas o botão na interface.** Hoje essa função está "órfã" — ninguém a chama do frontend.

### O que vou fazer

Adicionar um botão **"Reativar Todos os Webhooks"** no painel **Monitor de Envios** (`/monitor-envios`), que é onde já ficam os controles operacionais de WhatsApp.

**Comportamento:**
1. Botão com ícone de raio (Zap) ao lado dos outros controles do painel
2. Ao clicar → abre `AlertDialog` de confirmação ("Isso vai reativar os webhooks de todas as suas instâncias ativas. Continuar?")
3. Confirmando → chama `supabase.functions.invoke('whatsapp-qr', { body: { action: 'setup-webhook-all' } })`
4. Mostra loading com contador
5. Ao terminar → toast com resumo: "✅ X de Y webhooks reativados" + lista expansível com detalhes por instância (sucesso/falha + erro)
6. Se houver falhas → toast amarelo com botão "Tentar novamente"

### Arquivos a modificar

- `src/pages/MonitorEnvios.tsx` — adicionar botão + dialog + handler

### O que NÃO será feito

- Nenhuma mudança no backend (já está pronto e testado)
- Nenhum cron job automático (você ativa manualmente quando precisar — economiza Lovable Cloud)
- Nenhuma migração de banco

### Custo

**Zero impacto adicional** em Lovable Cloud. A edge function já existe e só roda quando você clicar no botão.

### Próximo passo (opcional, para depois)

Se a UAZAPI continuar desabilitando webhooks "do nada", podemos criar um **cron de saúde** que verifica a cada 30 min se algum webhook caiu e reativa só os afetados. Mas isso aumenta consumo de Cloud — só faria sentido se o problema for recorrente. Por enquanto, botão manual é o mais econômico.

Aprovar para eu adicionar o botão.
