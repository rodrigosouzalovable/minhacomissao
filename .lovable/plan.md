## Parte 1 — Filtro de WhatsApp na aba "Modelo Mensagem"

Replicar o mesmo padrão de validação que já existe em **Envio Meta Massa** (`check-whatsapp-numbers` via UAZAPI), aplicado à tabela de clientes importados da planilha.

### O que muda na UI (`src/pages/ModeloMensagem.tsx`, aba "Importar planilha")

1. **Novo bloco "Validar WhatsApp"** no Card 1 (logo abaixo dos descontos), só aparece quando há clientes importados:
   - Select com as instâncias UAZAPI conectadas do usuário (mesma query que `EnvioMeta` usa: `user_whatsapp_instances` ativas/conectadas).
   - Botão **"Verificar WhatsApp"** → chama a edge function `check-whatsapp-numbers` enviando todos os telefones de todos os clientes em uma única chamada (em lote — a função já trata batches de 15 internamente).
   - Indicador de progresso/loading enquanto valida.
   - Ao finalizar: toast com resumo `✅ X com WhatsApp / ❌ Y sem WhatsApp / ⚠️ Z erro`.

2. **Marcação visual por telefone na tabela "Clientes & Propostas":**
   - Cada telefone passa a ser classificado em 3 estados: `desconhecido` (cinza, comportamento atual), `valido` (verde discreto / ícone ✓) e `sem_whatsapp` (texto **vermelho** + tachado + ícone ✗ + tooltip "Sem WhatsApp").
   - Estado armazenado em um `Map<telefone_normalizado, 'valido'|'sem_whatsapp'|'erro'>` no componente, persistido junto com `clientes`/`contatados` em `modelo_mensagem_estado` (campo novo `whatsapp_status` JSON) — assim a marcação sobrevive a reload/troca de dispositivo, igual ao resto da aba.
   - Normalização de telefone reaproveita a mesma função `formatPhone` (prefixo 55) usada pela edge function para casar a resposta com os números exibidos.

3. **Novos filtros rápidos** acima da tabela (chips):
   - "Todos" · "Com WhatsApp" · "Sem WhatsApp" · "Não verificados".
   - Filtra as linhas exibidas sem destruir os dados.

4. **Contadores no header da lista:** `N clientes • X com WA • Y sem WA • Z contatado(s)`.

5. **Botão "Limpar validação"** ao lado de "Limpar lista" — zera só o `whatsapp_status` sem perder os clientes.

### Backend / dados

- **Sem mudança na edge function** `check-whatsapp-numbers` — já recebe array de números e devolve `valid/invalid/errors`.
- **Migração leve** em `modelo_mensagem_estado`: adicionar coluna `whatsapp_status jsonb default '{}'::jsonb` (mapa telefone→status). Sem alteração de RLS além do que já existe.
- Persistência segue o mesmo debounce de 600 ms já presente no arquivo.

### Fora de escopo

- Não vai criar campanha de envio nessa aba (continua sendo cópia manual).
- Não vai mexer no `ColarImagemTab` (uma imagem só não justifica o fluxo).

---

## Parte 2 — Pesquisa: IA que aprende observando você usar 4 monitores

Resumo do que existe hoje no mercado para "macro com IA / funcionário digital que aprende vendo":

### Categoria A — Agentes que controlam o computador via IA (modelos de visão + ações)
- **Anthropic Claude — Computer Use** (API `computer-use`): o modelo enxerga a tela e move mouse/teclado. Bom para tarefas descritas em linguagem natural, ainda não "aprende observando" — você precisa instruir.
- **OpenAI Operator / Agent Mode (GPT-5)**: agente que opera navegador (e, em previews recentes, o desktop). Também é instruído, não treinado por observação.
- **Microsoft Copilot Actions / UFO² (UI-Focused Agent for Windows)**: nativo Windows, multi-app. Foco em produtividade, multi-monitor suportado.
- **Google Project Mariner / Gemini Computer Use**: agente que navega e age na tela.

### Categoria B — RPA tradicional com camada de IA / "Process Capture"
Estes são os que mais se aproximam de "me observa trabalhando e aprende":
- **UiPath Task Mining / Task Capture + Autopilot**: roda um gravador em background, captura cliques/telas em todos os monitores, gera o fluxo de automação automaticamente e a IA sugere otimizações. É o mais próximo do que você descreveu.
- **Microsoft Power Automate Desktop + Process Mining**: grava ações, IA gera o fluxo, integra com Copilot.
- **Automation Anywhere — Co-Pilot / Process Discovery**: similar.
- **Tektronic Workfusion, Blue Prism, Kofax**: enterprise, mesma ideia.

### Categoria C — "Aprende vendo demonstrações" (mais novo, ainda imaturo)
- **Adept ACT-1 / Fuyu** (em pivot): protótipos de agente que aprende por demonstração.
- **Rabbit LAM (Large Action Model)**: marketing fala em "aprender vendo", entrega real é limitada.
- **OpenAdapt** (open-source, MIT): grava tela + entradas e usa LLM multimodal para reproduzir. Roda local, suporta multi-monitor. É o mais honesto na proposta "macro com IA".
- **Self-Operating Computer** (HyperWriteAI, open-source): GPT-4V controlando o desktop.

### Recomendação prática para 4 monitores + rotina de cobrança
1. **Para automação imediata e confiável:** UiPath StudioX ou Power Automate Desktop — gravam tudo que você faz nos 4 monitores e geram o robô; depois você refina. Free tier existe.
2. **Para experimentar IA que "aprende vendo":** OpenAdapt local (open-source) — coloca para gravar enquanto trabalha um dia inteiro, depois pede para reproduzir.
3. **Para tarefas pontuais em linguagem natural ("abre o Cob+, copia esses CPFs e cola no WhatsApp"):** Claude Computer Use ou Copilot Actions.

> Posso aprofundar qualquer um desses (custo, instalação, exemplo de fluxo no Cob+) — me diga qual te interessa. Essa parte é só pesquisa; não vai gerar código no projeto.

---

## Resumo do que vai ser implementado nesta tarefa

1. Migração: adicionar `whatsapp_status jsonb` em `modelo_mensagem_estado`.
2. Editar `src/pages/ModeloMensagem.tsx`: bloco validador, estado, badges/cores na tabela, filtros, contadores, persistência.

Posso seguir?