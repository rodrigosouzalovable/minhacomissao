

## Plano: Redesign do player de áudio estilo WhatsApp

O player de áudio atual usa o `<audio controls>` nativo do navegador, que é genérico e não se parece com o WhatsApp. Vamos criar um player customizado que simula o visual do WhatsApp.

### Referência visual (WhatsApp)
- Botão play/pause circular
- Barra de waveform (ondas sonoras) ou barra de progresso estilizada
- Duração do áudio exibida abaixo
- Cores diferentes para mensagens enviadas (verde) vs recebidas (branco)

### O que será feito

**1. Criar componente `WhatsAppAudioPlayer`**
- Novo arquivo: `src/components/inbox/WhatsAppAudioPlayer.tsx`
- Usa `HTMLAudioElement` programaticamente (sem `<audio controls>`)
- Botão play/pause com ícone
- Barra de progresso clicável/arrastável com visual de waveform (barras verticais geradas aleatoriamente baseadas em seed do ID da mensagem)
- Exibe tempo atual / duração total
- Indicador de velocidade (1x, 1.5x, 2x) ao clicar
- Cores adaptadas: verde para `saida`, cinza/branco para `entrada`

**2. Atualizar `ChatMessage.tsx`**
- Substituir o `<audio controls>` pelo novo `WhatsAppAudioPlayer`
- Passar `src`, `isSaida` e `messageId` como props

### Detalhes técnicos
- O waveform será simulado com barras CSS (como no WhatsApp) usando um array de alturas pseudo-aleatórias derivadas do ID da mensagem
- O progresso será controlado via `audioRef.currentTime` e `audioRef.duration`
- O componente gerencia seus próprios estados de play/pause/seeking
- Nenhuma lib externa necessária

