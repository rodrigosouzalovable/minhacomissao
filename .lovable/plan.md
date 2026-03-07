

## Streaming de Vídeo do Robô CobMais

### Resumo

Adicionar um player de streaming ao painel de Automação CobMais que exibe em tempo real a tela do navegador Playwright rodando no servidor local. Isso permite acompanhar o robô executando o fluxo de geração de boletos sem precisar acessar o computador local.

### Arquitetura

O servidor Playwright local (via ngrok) já aceita conexões HTTP. A abordagem mais simples e compatível com a arquitetura atual é **polling de screenshots** em vez de WebSocket/Socket.IO, pois:

- Não requer instalar `socket.io-client` (dependência pesada)
- Funciona através do ngrok sem configuração extra
- Não precisa de mudanças no CORS do servidor local além do que já existe
- Mais resiliente a desconexões

```text
┌─────────────────┐     polling (GET /screenshot)     ┌──────────────────┐
│  Frontend React  │ ◄──────────────────────────────► │ Servidor Playwright│
│  (Meus Acordos)  │     a cada ~1s via fetch          │  (local + ngrok)  │
└─────────────────┘                                    └──────────────────┘
```

O frontend faz `fetch` direto ao ngrok URL (já configurado no campo `serverUrl`) pedindo um screenshot a cada 1 segundo. O servidor Playwright precisa expor um endpoint `GET /screenshot` que retorna uma imagem base64 ou JPEG.

### O que será criado/modificado

**1. Novo componente `src/components/RoboStreamViewer.tsx`**
- Player de imagem que faz polling de screenshots do servidor Playwright
- Indicador de conexão (conectado/desconectado)
- Botão play/pause para iniciar/parar o polling
- Overlay de status mostrando a etapa atual da automação
- Log de eventos da automação (últimos 10)
- Usa `serverUrl` do estado pai para montar a URL de polling
- Estilizado com shadcn/ui (Card, Badge, Button, ScrollArea) para manter consistência visual

**2. Modificação em `src/pages/AutomacaoCobMais.tsx`**
- Adicionar nova aba "Streaming" no painel ou seção dedicada abaixo do console
- Renderizar `RoboStreamViewer` passando `serverUrl` como prop
- O streaming só aparece quando o robô está online

### Requisito no servidor Playwright local

O servidor local precisa expor um endpoint:
```
GET /screenshot
→ Response: { image: "data:image/jpeg;base64,...", url: "página atual", status: "executando" }
```

Sem esse endpoint, o player mostrará "Aguardando streaming..." — o que é aceitável como estado inicial.

### Dependências

Nenhuma nova dependência necessária. Usa `fetch` nativo + componentes shadcn/ui existentes.

