# Reenvio automático da confirmação do portal por outra instância

## O que aconteceu
A confirmação do Alan (17:32) saiu pela Novo Mundo 3144 e a Meta aceitou o pedido. Segundos depois, a Meta devolveu a falha **"Business eligibility payment issue"**: um problema de pagamento na conta da BM desse número. Por isso o aviso do sistema disse "enviada", mas a mensagem nunca chegou. Hoje a confirmação só tenta o 3144, sem plano B.

## O que vai mudar
1. **Quando a Meta informar a falha** da confirmação do portal, o sistema tenta de novo por outra instância, sem ação da equipe.
2. **Ordem de tentativa:**
   - primeiro, o número que já falou com o cliente (no caso do Alan, o número da campanha Odres que mandou o link);
   - depois, para Odres Cred, o número exclusivo 62 98275-6510;
   - depois, outras instâncias próprias ativas, GREEN, sem bloqueio nem problema de pagamento, que tenham o template `confirmacao_acordo_portal` aprovado.
3. **Limite:** até 4 tentativas no total, uma instância por vez. Cada instância que falhar é descartada para essa confirmação. Isso evita custo em loop.
4. **Aviso ao admin:** o aviso "Novo acordo fechado pelo portal" deixa de dizer "enviada" antes da entrega real. Se todas as tentativas falharem, chega um novo aviso: "Confirmação NÃO entregue ao cliente X — enviar manualmente".
5. **Reenvio agora para o Alan** por outra instância, assim que você aprovar.

## Custo
Cada reenvio é uma mensagem Utility a mais, cobrada só quando a primeira falha. Não adiciona agendamento nem consultas repetidas: o reenvio é disparado pelo próprio aviso de falha da Meta.

## Detalhes técnicos
- `_shared/portal-confirmacao-cliente.ts`: `escolherInstanciasConfirmacao(db, telefone, credor)` monta a lista (última instância de saída pelo sufixo → exclusiva do credor → pool saudável com o template aprovado). Grava a tentativa em `payload_diagnostico` da mensagem (`portal_confirmacao: {tentativa, excluidas, dados}`).
- Webhook Meta (status `failed`): quando `template_nome = confirmacao_acordo_portal` e a tentativa for menor que 4, chamar o reenvio com a próxima instância. Erros de pagamento/bloqueio (131042, eligibility) também marcam a instância como "evitar" pela classificação comercial que já existe.
- Usar `send-whatsapp-meta`, que já revalida janela e cota no servidor.
- Teste unitário para a ordem de escolha e o limite de 4 tentativas.
