## Mudanças em `src/pages/Notificacoes.tsx`

### 1. Remover botão "Conectar via QR Code"
- Apagar o botão da linha 269-271 (header do card "WhatsApp Notificador"). A função `openQr` e o diálogo de QR no rodapé permanecem por enquanto (sem botão de gatilho), ou removo também se preferir — minha proposta é remover apenas o botão visível conforme o pedido. O fluxo passa a ser: selecionar instância → clicar "Salvar configuração".

### 2. Transformar "Testar D-1" e "Testar D0" em teste fictício
- Trocar `handleTestRun` para NÃO chamar a edge function `notificar-boletos-pendentes` (que dispara para todos os operadores reais).
- Em vez disso, montar localmente uma mensagem de exemplo com os mesmos placeholders do lembrete real, usando dados fictícios fixos:
  - Operador: nome do próprio admin logado (`profiles.nome`) — para parecer real.
  - Cliente: "JOÃO DA SILVA TESTE", CPF "123.456.789-00", parcela 1.
  - Vencimento: amanhã (D-1) ou hoje (D0) formatado pt-BR.
  - Linha "Número que falou com o cliente: (11) 99999-0000".
  - Botão "Boleto Enviado" + rodapé "Clique abaixo após enviar o boleto".
- Enviar via `send-whatsapp-buttons` para **apenas um destino**: o telefone do próprio admin que está testando. Buscar esse número em `notificacoes_operador_telefone` filtrando por `user_id = auth.user.id`; se não houver cadastrado, mostrar `toast.error("Cadastre seu telefone na lista de operadores para receber o teste")`.
- Usa a instância configurada em `notificacoes_config` (mesma do envio real). Se nenhuma configurada, `toast.error("Configure a instância e salve antes de testar")`.
- Toast de sucesso: `"Mensagem fictícia D-1 enviada para seu número"`.

### 3. Sem mudanças no backend
- `notificar-boletos-pendentes` continua igual — segue rodando pelos crons reais (D-1 17 UTC, D0 12 UTC) com dados reais.

## Verificação

- Clicar em "Testar D-1": chega no WhatsApp do admin uma mensagem de exemplo com JOÃO DA SILVA TESTE + botão "Boleto Enviado" + rodapé. Nenhum outro operador recebe nada.
- Idem para "Testar D0".
- "Conectar via QR Code" sumiu do header do card.
- "Salvar configuração" continua salvando normalmente.
