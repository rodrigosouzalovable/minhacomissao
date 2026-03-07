

# Aprendizado por Vídeo Narrado — Análise de Viabilidade e Plano

## A ideia é excelente

Gravar a tela com narração em voz é como treinar um novo funcionário: você mostra e explica ao mesmo tempo. A IA pode extrair **muito mais contexto** de um vídeo narrado do que apenas capturando cliques e seletores CSS (que é o sistema atual).

## Como funcionaria tecnicamente

1. **Você grava** a tela usando a extensão Screen Recorder (gera um arquivo .webm ou .mp4)
2. **Faz upload** do vídeo na página de Automação CobMais
3. **Uma Edge Function** processa o vídeo em 2 etapas:
   - **Transcrição do áudio**: extrai o que você falou (já temos isso com Gemini)
   - **Análise visual**: extrai frames-chave e descreve cada tela/ação visível
4. **A IA combina** fala + visual para gerar passos estruturados no formato `cobmais_conhecimento`
5. O conhecimento fica **permanentemente salvo** e é injetado no prompt do Agente

## Modelo de IA

O Gemini 2.5 Pro (que já usamos) suporta **vídeo + áudio nativamente** — ele pode receber o vídeo inteiro e entender tanto o que está na tela quanto o que está sendo dito. Não precisamos de serviços externos.

## Alterações necessárias

| Componente | Mudança |
|---|---|
| **Storage bucket** | Criar bucket `cobmais-videos` para armazenar os vídeos enviados |
| **Nova Edge Function `process-cobmais-video`** | Recebe o vídeo, envia ao Gemini com prompt para extrair passos estruturados (ação, seletor, descrição narrada), salva na tabela `cobmais_conhecimento` |
| **UI `AutomacaoCobMais.tsx`** | Adicionar área de upload de vídeo na aba Conhecimento, com indicador de progresso e resultado do processamento |

## Fluxo do usuário

1. Grava a tela + narração com a extensão Chrome
2. Abre a aba "Conhecimento" na Automação CobMais
3. Clica "Enviar Vídeo de Treinamento", dá um nome ao fluxo (ex: "Como gerar boleto")
4. Faz upload do arquivo .webm/.mp4
5. Aguarda processamento (~30-60s)
6. Visualiza os passos extraídos pela IA
7. Próxima execução do agente já usa esse conhecimento

## Limitações a considerar

- **Tamanho do vídeo**: Gemini aceita até ~1h de vídeo, mas o upload no Lovable tem limite de 20MB. Vídeos curtos e focados (2-5 min por fluxo) são ideais.
- **Qualidade dos seletores**: A IA pode não identificar seletores CSS exatos a partir do vídeo — ela vai gerar descrições textuais que complementam os seletores já gravados pelo Playwright.

## Resultado esperado

O sistema atual (gravação Playwright) captura **seletores técnicos** mas sem contexto humano. O vídeo narrado adiciona **explicações em linguagem natural** — "aqui eu clico no botão amarelo porque é onde fica o menu de boletos". A combinação dos dois métodos cria um conhecimento muito mais rico.

