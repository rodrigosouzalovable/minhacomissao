# Plano: Áudio Transcrito no WhatsApp Inbox

## Objetivo
No `WhatsAppInbox`, ao clicar no botão de microfone, abrir um menu (popover) com duas opções:
1. **Enviar áudio** — comportamento atual (gravar e enviar como áudio de voz).
2. **Enviar áudio transcrito** — gravar voz, transcrever automaticamente em texto (pt-BR) e enviar como mensagem de texto normal.

## Como funcionará (visão do usuário)

```text
[🎤] ← clique
 ├── 🎙  Enviar áudio (voz)
 └── 📝 Enviar áudio transcrito (vira texto)
```

Ao escolher **Áudio transcrito**:
- A barra de gravação atual aparece (mesma UI: bolinha vermelha pulsando + cronômetro + botões cancelar/enviar).
- Ao clicar em enviar, mostra "Transcrevendo..." brevemente.
- O texto transcrito é enviado como mensagem normal (com a UI otimista — checks ⏱ → ✓).
- Em caso de transcrição vazia ou erro, mostra toast e NÃO envia nada.

## Detalhes técnicos

### 1. `src/hooks/useAudioRecorder.tsx`
- Adicionar novo método `transcreverGravacao(): Promise<string | null>` que:
  - Para o `MediaRecorder`, gera o blob, converte para base64.
  - Invoca a edge function existente **`transcribe-audio`** (já usa Gemini via Lovable AI Gateway, sem API key extra).
  - Retorna o texto transcrito (ou `null` em caso de erro/vazio).
- Manter `enviarGravacao` intacto.
- Expor um novo estado `transcrevendo: boolean` para feedback de UI.

### 2. `src/components/inbox/ChatInputBar.tsx`
- Novo estado local `modoGravacao: 'audio' | 'transcrito' | null`.
- Substituir o botão de microfone por um `DropdownMenu` (shadcn) com dois itens:
  - "Enviar áudio" → seta `modoGravacao = 'audio'` e chama `iniciarGravacao()`.
  - "Enviar áudio transcrito" → seta `modoGravacao = 'transcrito'` e chama `iniciarGravacao()`.
- No bloco de UI quando `gravando === true`:
  - Mostrar um chip indicando o modo: "Gravando áudio" ou "Gravando para transcrever".
  - Botão de enviar:
    - Se `modoGravacao === 'audio'` → `enviarGravacao()` (atual).
    - Se `modoGravacao === 'transcrito'` → chama `transcreverGravacao()`, e ao receber texto chama `onTextSent(texto)` (mesmo fluxo otimista do envio de texto).
- Resetar `modoGravacao` ao cancelar/finalizar.
- Mostrar `Loader2` + "Transcrevendo..." enquanto aguarda a edge function.

### 3. Edge function `transcribe-audio`
- Já existe (`supabase/functions/transcribe-audio/index.ts`), usa `google/gemini-2.5-flash-lite` via Lovable AI.
- **Sem custo de API key adicional** — apenas consome créditos Lovable AI já configurados.
- **Aviso de custo (regra do projeto)**: cada áudio transcrito gera uma chamada paga ao Lovable AI Gateway. Volume baixo/moderado = custo desprezível, mas se o time usar massivamente isso pode aumentar a fatura mensal de IA. Sem alteração nos demais custos de Cloud.

## Arquivos a modificar
- `src/hooks/useAudioRecorder.tsx` — adicionar `transcreverGravacao` + estado `transcrevendo`.
- `src/components/inbox/ChatInputBar.tsx` — dropdown no botão do microfone, lógica de modo, integração com transcrição.

## Sem alterações em
- Banco de dados.
- Outras edge functions.
- Demais páginas (CampanhasVoz, Acionamento etc.).

## Aviso de custo
Conforme regra do projeto, isto adicionará chamadas pagas ao Lovable AI Gateway (modelo `gemini-2.5-flash-lite`, o mais barato da família). Custo por transcrição é muito baixo, mas escala com o uso. Aprovar?
