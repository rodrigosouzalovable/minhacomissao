

## Plano: Adicionar Áudios e Imagens ao Aquecimento

### O que será feito

Copiar os 3 áudios MP3 e as 7 imagens enviadas para o bucket de storage, e criar registros na tabela `whatsapp_aquecimento_dialogos` apontando para as URLs públicas.

### Arquivos de mídia

**Áudios (3 MP3):**
- Mario voice → `aquecimento/audio_mario.mp3`
- Adam Borges voice → `aquecimento/audio_adam.mp3`
- Lax Whisper voice → `aquecimento/audio_whisper.mp3`

**Imagens (7 JPG):**
- Bom dia terça-feira (balões/flores)
- 6 imagens motivacionais/religiosas

### Etapas

| # | Ação |
|---|------|
| 1 | Copiar os 10 arquivos para o projeto temporariamente |
| 2 | Criar script que faz upload de cada arquivo para o bucket `campaign-audio` (pastas `aquecimento/` e `aquecimento-imagens/`) |
| 3 | Inserir 10 novos registros em `whatsapp_aquecimento_dialogos` com as URLs públicas geradas |
| 4 | Áudios serão fase_minima = 2, imagens fase_minima = 1 |

### Detalhes técnicos

- Os áudios vão para `campaign-audio/aquecimento/*.mp3`
- As imagens vão para `campaign-audio/aquecimento-imagens/*.jpg`
- Cada arquivo gera uma URL pública do tipo `https://cymdrkeukockakfzjeen.supabase.co/storage/v1/object/public/campaign-audio/...`
- Os registros existentes com nomes de arquivo sem URL (ex: `audio_boa_tarde.ogg`) serão mantidos — os novos arquivos reais complementam o pool

