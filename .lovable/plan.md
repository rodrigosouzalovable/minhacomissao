

## Upload de Áudio por Tipo de Lembrete + Envio de Áudio na Aba Lembretes

### Resumo
1. Adicionar campo de upload de áudio em cada aba (D-3, D-0, D+1...) no dialog "Mensagens de Lembrete"
2. Adicionar opção "Enviar áudio" no dropdown do avião na aba Lembretes, que envia o áudio correspondente ao tipo de atraso do cliente
3. A opção "Enviar áudio" só aparece quando existe um áudio configurado para aquele tipo de lembrete

### Alterações

**Migração de banco de dados:**
- Adicionar coluna `audio_url text` à tabela `lembrete_mensagens_templates` para armazenar a URL do áudio de cada tipo de lembrete

**Arquivo: `src/components/LembreteMensagensDialog.tsx`**

1. Adicionar campo `audio_url` à interface `TemplateRow`
2. Abaixo do Textarea de mensagem, renderizar uma seção de áudio:
   - Se não há áudio: botão "Importar áudio" que abre um file input (`accept="audio/*"`)
   - Se há áudio: player de áudio (`<audio>` com controls) + botão para remover o áudio
3. No upload: fazer upload para o bucket `campaign-audio` com path `{user_id}/lembretes/{tipo_lembrete}.mp3`, obter URL pública e salvar no template
4. No `handleSave`: incluir `audio_url` nas rows inseridas

**Arquivo: `src/components/PaymentReminders.tsx`**

1. Expandir a interface `LembreteTemplate` para incluir `audio_url?: string`
2. No fetch de templates (useEffect), incluir `audio_url` no select
3. No dropdown do avião (DropdownMenu, linhas ~299-344), adicionar uma terceira opção "Enviar áudio" entre "Enviar mensagem" e "Marcar como enviado":
   - Só aparece se existe um template com `audio_url` para o `tipo` do lembrete
   - Ao clicar: invoca a edge function `send-whatsapp-audio` com o telefone do cliente e a `audio_url` do template correspondente ao tipo de atraso
   - Usa a mesma lógica de round-robin de instâncias

**Lógica de mapeamento tipo -> audio_url:**
- Lembrete com `tipo === 'hoje'` → template `dia_vencimento`
- Lembrete com `tipo === '3_dias'` → template `3_dias`
- Lembrete com `tipo === 'vencido'` → calcular dias de atraso e buscar template `vencido_d{dias}` mais próximo

### Detalhes técnicos

- O bucket `campaign-audio` já existe com acesso público (necessário para a UAZAPI baixar o arquivo)
- A edge function `send-whatsapp-audio` já existe e aceita `{ telefone, audio_url, uazapi_server_url, uazapi_instance_token, instancia_id }`
- O upload substitui o arquivo anterior no mesmo path (upsert), evitando acúmulo de arquivos
- A URL pública é obtida via `supabase.storage.from('campaign-audio').getPublicUrl(path)`

