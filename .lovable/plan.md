
## Objetivo

Na página **Modelo Mensagem** (`/modelo-mensagem`), adicionar duas abas no topo do conteúdo:

1. **Importar planilha** — exatamente o fluxo atual (xlsx do Cob+), sem alterações.
2. **Colar imagem** (novo) — funcionário cola/anexa um print da tela do Cob+ (igual ao exemplo enviado), a IA extrai os dados, monta a mensagem usando o mesmo template e o funcionário copia.

O botão **Editar Modelo** (canto superior direito) continua o mesmo e é compartilhado pelas duas abas — qualquer edição do template já reflete no resultado das duas.

## Aba "Colar imagem" — comportamento

Layout em duas colunas (empilha no mobile):

**Coluna esquerda — Entrada da imagem**
- Área grande de drop / colar com mensagem "Cole (Ctrl+V) ou arraste o print aqui".
- Suporta:
  - `Ctrl+V` colando print da área de transferência (listener `paste`).
  - Drag-and-drop de arquivo de imagem.
  - Botão "Selecionar arquivo" como fallback.
- Mostra preview da imagem colada.
- Botão **Extrair dados** dispara a chamada à IA. Estado de loading com spinner.
- Botão **Limpar** para começar de novo.

**Coluna direita — Resultado**
- Formulário com os campos extraídos, todos editáveis manualmente (a IA pode errar):
  - Nome completo
  - CPF
  - Contrato
  - Dias de atraso
  - Qtd. de parcelas em atraso (se a IA não achar, deixa 1 como padrão e o usuário ajusta)
  - Total em atraso (R$)
- Mesmos campos globais de % desconto à vista e % desconto parcelado já existentes (reaproveita o estado da página).
- **Pré-visualização da mensagem** renderizada em tempo real com o template salvo (atualiza ao digitar nos campos ou mudar desconto).
- Botões: **Copiar mensagem** e **Copiar CPF** / **Copiar nome**.

## Extração por IA

- Edge function nova `supabase/functions/extract-modelo-mensagem/index.ts`.
- Recebe `{ imageBase64: string }` do cliente.
- Usa **Lovable AI Gateway** com modelo de visão `google/gemini-3-flash-preview` (já é o padrão e é multimodal). Sem custo extra de chave (usa `LOVABLE_API_KEY` já existente).
- Prompt instrui a IA a devolver **JSON estrito** com:
  ```json
  {
    "nome": "REIGIANE MACARIO DA CRUZ",
    "cpf": "071.512.775-63",
    "contrato": "00076777887",
    "dias_atraso": 155,
    "qtd_parcelas_atraso": 1,
    "total_atraso": 1086.69
  }
  ```
- Trata 429 (rate limit) e 402 (créditos) com mensagens amigáveis.
- Validação básica no servidor (Zod) antes de devolver.

## Renderização da mensagem

Reaproveita 100% a função `renderMensagem` de `src/lib/parseCobmaisPlanilha.ts`, montando um objeto `ClienteImportado` a partir dos campos extraídos/editados (telefones = `[]`, parcelas vazias — o template padrão não exige). Assim, qualquer mudança feita no botão "Editar Modelo" continua sendo respeitada igualmente nas duas abas.

## Arquivos a criar / alterar

- **Alterar** `src/pages/ModeloMensagem.tsx`
  - Envolver o conteúdo atual em `<Tabs>` com 2 `<TabsTrigger>` ("Importar planilha", "Colar imagem").
  - Aba 1: move os Cards existentes para dentro do `TabsContent`.
  - Aba 2: renderiza o novo componente `<ColarImagemTab />`.
- **Criar** `src/components/modelo-mensagem/ColarImagemTab.tsx`
  - Toda a UI de colar/dropar imagem, preview, formulário editável e preview de mensagem.
  - Props: `template`, `descVistaGlobal`, `descParceladoGlobal`, `parceladoQtdGlobal`.
- **Criar** `supabase/functions/extract-modelo-mensagem/index.ts`
  - Endpoint POST que chama a Lovable AI com a imagem e devolve o JSON validado.
- **Alterar** `supabase/config.toml`
  - Registrar a nova função com `verify_jwt = true` (página é autenticada).

## Fora do escopo

- Salvar histórico de imagens extraídas no banco.
- Enviar a mensagem pelo WhatsApp daqui (mantém só "Copiar", igual à aba atual).
- Mexer no fluxo da aba "Importar planilha" — fica idêntico.

## Riscos / observações

- A IA pode confundir o **CPF** (071.512.775-63) com outros números da tela; por isso todos os campos são editáveis antes de copiar.
- O exemplo mostra "Atraso: 155" — confirmar com a IA que pegue esse número e não a quantidade de telefones (6) nem o número do contrato.
- Custo por extração: 1 chamada multimodal Gemini Flash por imagem (baixo, mas vale lembrar — segue a regra de aviso de custos do projeto). **Será exibido um pequeno aviso na aba** indicando que cada extração consome créditos de IA.
