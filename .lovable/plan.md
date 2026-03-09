

# Plano: Chat IA executa ações reais (enviar mensagens WhatsApp)

## Problema
O chat "Ensinar IA" hoje **apenas simula** — ele entende sua instrução mas não tem conexão com o WhatsApp. Quando você diz "volta na conversa com +556493097974 e mande a proposta", a IA finge que fez, mas nada acontece de verdade.

## Solução
Dar ao chat a capacidade de **executar ações reais**: buscar conversas no banco, gerar propostas com valores reais e enviar via WhatsApp.

## Alterações

### 1. `supabase/functions/teach-chatbot/index.ts`
- Atualizar o system prompt para incluir uma nova ação `send`:
  ```
  {"action":"send","telefone":"556493097974","mensagem":"texto a enviar","message":"Mensagem enviada para Valeria!"}
  ```
- Quando detectar `action: "send"`:
  1. Buscar `chatbot_conversas` pelo telefone para obter `instance_token`, `server_url` e `dados` (valores financeiros)
  2. Se a instrução mencionar "proposta", usar os dados reais (`valor_avista`, `valor_parcelado`) para montar a mensagem
  3. Enviar via UAZAPI usando `server_url` e `instance_token` da conversa
  4. Atualizar o histórico da conversa no `chatbot_conversas`
  5. Retornar confirmação ao admin

### 2. System prompt enriquecido
- Informar a IA que ela pode **buscar dados reais** e **enviar mensagens**
- Incluir o fluxo: admin pede → IA monta proposta com valores reais → confirma com admin → admin diz "sim" → IA executa o envio
- Manter compatibilidade com o fluxo existente de ensinar regras (`action: "save"`)

### 3. Fluxo resultante
```text
Admin: "Volta na conversa com +556493097974 e passe a proposta"
                    ↓
IA busca chatbot_conversas → encontra Valeria, débito R$ 312
                    ↓
IA: "Encontrei a conversa da Valeria. Vou enviar:
'Que ótimo! Valor à vista: R$ 156,00 ou 2x de R$ 109,20.'
Posso enviar?"
                    ↓
Admin: "Sim"
                    ↓
IA envia via UAZAPI + responde "✅ Mensagem enviada!"
```

### 4. Segurança
- Apenas o fluxo de confirmação (admin diz "sim") dispara o envio real
- A IA sempre mostra a mensagem antes de enviar

