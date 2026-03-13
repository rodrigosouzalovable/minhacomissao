## ✅ Concluído — Resposta do Admin via WhatsApp

Implementado em `supabase/functions/whatsapp-chatbot/index.ts`:

1. **`parseAdminInstruction()`** — detecta se texto está entre aspas (literal) ou é instrução livre (IA gera resposta)
2. **`gerarRespostaComInstrucaoAdmin()`** — usa Gemini Flash Lite para formular resposta natural baseada na instrução + contexto
3. **Registro `admin_pending_{instanceToken}`** — salvo em `chatbot_conversas` quando `salvarSilenciosoENotificar` é chamado, mapeia qual cliente aguarda resposta
4. **Interceptação de mensagens do admin** — quando `telefone === ADMIN_NUMERO`, busca cliente pendente, envia resposta (literal ou IA), desbloqueia conversa
5. **Confirmação ao admin** — envia `✅ Mensagem enviada para {telefone}` após envio
6. **Cleanup** — remove registro `admin_pending` após processamento

## ✅ Concluído — Admin responde por número de telefone direto

1. **`parseAdminInstructionWithTarget()`** — regex expandido extrai telefone alvo de instruções naturais como "Volta na conversa com +556493097974 e passe a proposta", "Responda ao numero X", "Envie para X", etc.
2. **Verbos suportados**: volta, retorne, responda, envie, mande, fale, passe, vá, vai
3. **Preposições suportadas**: numero, número, para, ao, com, do, da, de (com suporte a `+55`)
4. **Busca conversa por telefone** — localiza `chatbot_conversas` pelo número especificado
5. **Detecção de "proposta"** — se instrução contém "proposta/valor/oferta", gera mensagem financeira com `gerarMensagemProposta()`
6. **Fluxo confirmação** — reutiliza o fluxo `admin_pending` existente para confirmação antes de enviar

## ✅ Concluído — Chat IA executa ações reais (enviar WhatsApp)

Implementado em `supabase/functions/teach-chatbot/index.ts`:

1. **Contexto real** — `fetchConversasContext()` busca até 50 conversas ativas do `chatbot_conversas` e injeta no system prompt (nome, telefone, valores financeiros)
2. **Action `send`** — quando a IA responde `{"action":"send","telefone":"X","mensagem":"Y"}`, o sistema:
   - Busca a conversa pelo telefone para obter `instance_token` e `server_url`
   - Envia a mensagem real via UAZAPI (com fallback de endpoints)
   - Atualiza o estado da conversa (desbloqueia se estava em `aguardando_admin`)
3. **Fluxo de confirmação** — a IA sempre mostra a mensagem antes de enviar e espera o admin confirmar ("sim")
4. **Compatibilidade** — action `save` (ensinar regras) continua funcionando normalmente
5. **Segurança** — dados financeiros vêm do banco, nunca inventados pela IA

## ✅ Concluído — Admin comanda a IA via WhatsApp (fallback teach-chatbot)

1. **Fallback inteligente** — quando a mensagem do admin não casa com `admin_pending` nem `parseAdminInstructionWithTarget`, é encaminhada para `teach-chatbot`
2. **Histórico compartilhado** — carrega últimas 10 mensagens de `chat_ia_mensagens` do admin para contexto
3. **Persistência** — salva mensagem do admin e resposta da IA em `chat_ia_mensagens` (mesmo histórico do chat web)
4. **Resposta via WhatsApp** — a IA responde diretamente ao admin no WhatsApp
5. **Ações reais** — como o `teach-chatbot` suporta `action: "send"`, o admin pode instruir envios reais também pelo WhatsApp

## ✅ Concluído — Cadência de lembretes para parcelas vencidas

Implementado em `supabase/functions/check-payment-reminders/index.ts`:

1. **Substituição da query genérica** — removida busca por range (últimos 30 dias), substituída por busca em 6 datas exatas
2. **Datas-alvo calculadas**: D+1, D+2, D+10, D+11, D+20, D+30 a partir de hoje
3. **Tipos distintos**: `vencido_d1`, `vencido_d2`, `vencido_d10`, `vencido_d11`, `vencido_d20`, `vencido_d30` — deduplicação automática por `pagamento_id` + `tipo_lembrete`
4. **Mensagens escalonadas**:
   - D+1: Tom amigável — "venceu ontem, envie comprovante"
   - D+2: Reforço amigável — "ainda consta em aberto"
   - D+10: Tom firme — "continua em aberto há 10 dias"
   - D+11: Reforço firme — "segue pendente há 11 dias"
   - D+20: Alerta — "regularize para evitar descumprimento"
   - D+30: Último aviso — "acordo poderá ser considerado descumprido"
5. **D-3 e D+0 inalterados** — lembretes pré-vencimento continuam funcionando como antes
