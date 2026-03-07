

# Auto-scroll para Streaming ao enviar comando no Chat

## O que será feito

Quando você enviar uma mensagem no chat da IA, a página rolará automaticamente até a seção "Streaming do Robô" para que você possa acompanhar a execução em tempo real.

## Implementação

| Arquivo | Mudança |
|---|---|
| `src/pages/AutomacaoCobMais.tsx` | Adicionar `useRef` no wrapper do `RoboStreamViewer` e chamar `scrollIntoView` no `handleChatSend` após enviar a mensagem |

### Detalhes técnicos
- Criar `streamingRef = useRef<HTMLDivElement>(null)` 
- Envolver o `<RoboStreamViewer>` em uma `<div ref={streamingRef}>`
- No `handleChatSend`, após adicionar a mensagem do usuário, chamar `streamingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })`
- Se o robô estiver offline (seção não visível), não rolar — o scroll só acontece quando a seção de streaming está renderizada

