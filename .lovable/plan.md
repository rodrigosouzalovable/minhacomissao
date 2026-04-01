

## Plano: Múltiplos áudios com rotação combinada (áudio + instância)

### Conceito
Atualmente a campanha suporta apenas 1 áudio. A mudança permitirá importar N áudios, que serão distribuídos em round-robin combinado com as instâncias WhatsApp selecionadas.

**Exemplo com 3 áudios e 4 WhatsApps:**
- Cliente 1 → WhatsApp 1 envia Áudio 1
- Cliente 2 → WhatsApp 2 envia Áudio 2
- Cliente 3 → WhatsApp 3 envia Áudio 3
- Cliente 4 → WhatsApp 4 envia Áudio 1
- Cliente 5 → WhatsApp 1 envia Áudio 2
- ...e assim por diante

### Mudanças no banco de dados

1. **Nova tabela `voice_campaign_audios`** para armazenar múltiplos áudios por campanha:
   - `id`, `campaign_id` (FK), `audio_url`, `file_name`, `created_at`
   - RLS: owner da campanha pode ler/inserir/deletar

2. **Coluna `audio_url` na tabela `voice_campaigns`** passa a ser opcional (nullable) — campanhas novas usarão a tabela de áudios

### Mudanças no frontend (`src/pages/CampanhasVoz.tsx`)

1. **Upload de múltiplos áudios**: trocar o input de arquivo único para `multiple`, permitindo selecionar vários arquivos de uma vez
2. **Lista de áudios**: exibir os áudios importados com preview (play) e opção de remover individualmente
3. **Criação da campanha**: fazer upload de todos os áudios para o bucket `campaign-audio` e inserir cada URL na tabela `voice_campaign_audios`
4. **Remover tipo "chamada de voz"**: simplificar a interface removendo a opção `voice_call`
5. **Campos de delay configurável**: adicionar inputs para min/max minutos (padrão 1-5 min)

### Lógica de envio (loop principal)

No loop de envio, para cada contato `i`:
- Instância = `activeInstances[i % activeInstances.length]`
- Áudio = `audios[i % audios.length]`

Isso cria a rotação combinada desejada automaticamente.

### Resumo de arquivos
- **Migração SQL**: criar tabela `voice_campaign_audios`, tornar `audio_url` nullable
- **`src/pages/CampanhasVoz.tsx`**: upload múltiplo, lista de áudios, delay configurável, rotação de áudios no envio

