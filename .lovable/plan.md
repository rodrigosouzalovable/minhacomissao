

# Botões Interativos no WhatsApp — Lembretes

## Visão Geral

Adicionar suporte a botões interativos do WhatsApp nas mensagens de lembrete, usando o endpoint UAZAPI `POST /send/menu` com `type: "button"`. Três mudanças principais:

1. **Configuração de botões** no dialog de Mensagens de Lembrete (LembreteMensagensDialog)
2. **Nova opção "Áudio + Botões"** no dropdown de envio individual (PaymentReminders)
3. **Nova Edge Function** para enviar mensagens com botões via UAZAPI

---

## Mudanças

### 1. Migração: adicionar colunas de botões na tabela `lembrete_mensagens_templates`

```sql
ALTER TABLE lembrete_mensagens_templates 
  ADD COLUMN botoes_texto TEXT DEFAULT NULL,
  ADD COLUMN botoes_choices JSONB DEFAULT NULL;
```

- `botoes_texto`: mensagem que acompanha os botões (pode usar as mesmas variáveis)
- `botoes_choices`: array JSON de strings no formato UAZAPI, ex: `["Sim, já paguei|paguei", "Preciso do boleto|boleto", "Falar com atendente|atendente"]`

### 2. Edge Function: `send-whatsapp-buttons`

Nova função que:
- Recebe `telefone`, `texto`, `choices`, `footerText`, credenciais UAZAPI e `instancia_id`
- Envia via `POST /send/menu` com `type: "button"`
- Salva no inbox (padrão existente de contact matching por sufixo)
- Payload UAZAPI:
```json
{
  "number": "5511...",
  "type": "button",
  "text": "Mensagem com botões",
  "choices": ["Opção 1|op1", "Opção 2|op2"],
  "footerText": "Escolha uma opção"
}
```

### 3. UI: Configuração de botões no `LembreteMensagensDialog`

Abaixo da seção de áudio, adicionar uma nova seção "Botões interativos":
- Textarea para a mensagem dos botões (com suporte a variáveis)
- Até 3 campos de input para o texto de cada botão (limite do WhatsApp)
- Botão para adicionar/remover botões
- Os dados são salvos nos novos campos `botoes_texto` e `botoes_choices`

### 4. UI: Nova opção no dropdown do PaymentReminders

No `DropdownMenu` de envio individual (linhas 316-422), adicionar entre "Enviar áudio" e "Marcar como enviado":

- **"Áudio + Botões"** (ícone: Volume2 + botão)
- Ao clicar:
  1. Envia o áudio (lógica existente via `send-whatsapp-audio`)
  2. Aguarda 2-3 segundos
  3. Envia a mensagem com botões via `send-whatsapp-buttons` usando `botoes_texto` e `botoes_choices` do template
  4. Se não houver botões configurados para o tipo, exibe toast de erro
  5. Marca como enviado após ambos os envios

### 5. Carregar dados de botões nos templates

Atualizar a interface `TemplateRow` e `LembreteTemplate` para incluir `botoes_texto` e `botoes_choices`. Carregar e salvar esses campos junto com os templates existentes.

---

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `botoes_texto` e `botoes_choices` em `lembrete_mensagens_templates` |
| `supabase/functions/send-whatsapp-buttons/index.ts` | Nova Edge Function para enviar botões via UAZAPI |
| `src/components/LembreteMensagensDialog.tsx` | Seção de configuração de botões por tipo de lembrete |
| `src/components/PaymentReminders.tsx` | Nova opção "Áudio + Botões" no dropdown + carregar campos de botões |

