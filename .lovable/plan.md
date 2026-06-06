## Liberar conexão WhatsApp na aba Notificações

Hoje o botão "Conectar via QR Code" só fica ativo após escolher uma instância existente no select. Vou ajustar para permitir conectar direto, criando uma nova instância dedicada se necessário.

### Mudanças em `src/pages/Notificacoes.tsx`

1. **Adicionar botão "Criar nova instância"** ao lado do select, abrindo um pequeno diálogo que pede só o nome (ex: "Notificador Boletos"). Ao salvar, cria registro em `user_whatsapp_instances` (mesma lógica usada hoje na aba WhatsApp) e já seleciona automaticamente.

2. **Habilitar o botão "Conectar via QR Code"** sempre que houver uma instância selecionada (já é o comportamento), mas remover o `disabled` quando a config já estiver salva — e se não houver nenhuma instância criada ainda, o botão abre direto o diálogo de criação.

3. **Garantir que o QR funcione** chamando `whatsapp-qr` com o `instanceId` selecionado (já implementado) e fazendo polling do status a cada 3s enquanto o diálogo estiver aberto, fechando automaticamente quando conectar.

4. **Após conectar via QR**, salvar automaticamente em `notificacoes_config` para não exigir clique extra em "Salvar configuração".

### Sem mudanças
- Tabelas, edge functions, cron e demais abas permanecem iguais.
- Lógica de envio dos lembretes não muda.
