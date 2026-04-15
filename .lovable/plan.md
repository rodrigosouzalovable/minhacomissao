

## Ativar Aquecimento Automático Diário + Envio de Áudios e Imagens

### Situação Atual

1. **Cron job existe** (`jobid:16`) mas com problemas:
   - Schedule: `*/15 7-20 * * 1-6` (UTC) = roda das 4h-17h BRT, apenas Seg-Sáb
   - Deveria rodar das 7h-21h BRT (10h-00h UTC), incluindo Domingo
   
2. **Áudios e imagens existem** no bucket `campaign-audio`:
   - Áudios: `aquecimento/audio_adam.mp3`, `audio_mario.mp3`, `audio_whisper.mp3`
   - Imagens: `aquecimento-imagens/img_bomdia_1.jpg`, `img_motivacional_1-6.jpg`
   
3. **Salvamento de contatos**: Ativo no código (`salvarContatoUAZAPI` existe no `whatsapp-ia-responder`) e config `salvar_contatos_auto: true`

4. **Conversas**: Atualmente só trocam **texto** — nenhum envio de áudio ou imagem na cadeia

### Correções

#### 1. Corrigir o cron job
- Remover o job atual (`jobid:16`)
- Criar novo com schedule `*/15 10-23 * * *` (UTC) = 7h-20h BRT, todos os dias incluindo domingo

#### 2. Adicionar envio de áudio e imagem na cadeia de conversas
No `whatsapp-ia-responder/index.ts`, dentro do fluxo `gerar-resposta`:
- A cada resposta na cadeia, sortear aleatoriamente (probabilidade ~20%) se envia áudio ou imagem em vez de texto
- **Áudio (~10%)**: Buscar um MP3 aleatório do storage (`campaign-audio/aquecimento/`), enviar via endpoint `/send/media` com type `ptt`
- **Imagem (~10%)**: Buscar uma imagem aleatória do storage (`campaign-audio/aquecimento-imagens/`), enviar via `/send/media` com type `image`
- A mensagem de texto da IA continua sendo gerada como legenda/contexto
- Registrar no inbox com `tipo_conteudo: "audio"` ou `"imagem"`

#### 3. Funções auxiliares no `whatsapp-ia-responder`
- `enviarAudioUAZAPI()`: busca URL pública do storage, envia via `/send/media` com `type: "ptt"`
- `enviarImagemUAZAPI()`: busca URL pública do storage, envia via `/send/media` com `type: "image"`
- `listarMidiaAquecimento()`: lista arquivos no bucket para sortear aleatoriamente

#### 4. Confirmar salvamento de contatos
- Já está implementado e funcional no `whatsapp-ia-responder` (linhas 172-211, 346-392, 523-548)
- Config `salvar_contatos_auto: true` ativa
- Nenhuma alteração necessária

### Arquivos
1. **`supabase/functions/whatsapp-ia-responder/index.ts`** — adicionar envio de áudio e imagem
2. **Cron job** — recriar com horário correto (7h-20h BRT, todos os dias)

