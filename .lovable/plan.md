
## Adicionar botao "Termo de Acordo" com geracao por IA

### Resumo

Criar um botao "Termo de Acordo" ao lado do botao "Notificacao Extrajudicial". Ao clicar, abre um Dialog onde o usuario descreve o acordo feito com o cliente. Ao clicar "GERAR", uma IA (via Lovable AI) gera um termo de acordo profissional como se fosse escrito por um advogado experiente. O resultado aparece em um campo editavel, com botoes para baixar em Word e PDF.

### Fluxo do usuario

1. Clica em "Termo de Acordo" na ficha do cliente
2. Dialog abre com um campo de texto para descrever os termos do acordo
3. Clica em "GERAR" - a IA processa e gera o termo profissional
4. O termo gerado aparece em um campo editavel (textarea)
5. O usuario pode editar se necessario
6. Botoes "Baixar Word" e "Baixar PDF" para download do documento final

### Alteracoes

**1. Nova edge function `supabase/functions/gerar-termo-acordo/index.ts`**

Edge function que recebe os dados do acordo e do cliente, envia para o Lovable AI Gateway (modelo `google/gemini-3-flash-preview`), e retorna o termo gerado. O prompt instrui a IA a agir como um advogado com anos de experiencia, gerando um termo de acordo extrajudicial completo e profissional, sem qualquer mencao a IA.

**2. Atualizar `supabase/config.toml`**

Adicionar a configuracao da nova funcao com `verify_jwt = false`.

**3. Modificar `src/pages/DevedorDetalhe.tsx`**

- Adicionar estados para o dialog do termo de acordo (`termoDialogOpen`, `termoInput`, `termoContent`, `termoGenerating`)
- Adicionar botao "Termo de Acordo" ao lado do botao "Notificacao Extrajudicial" (linha 609)
- Criar o Dialog com:
  - Textarea para o usuario descrever o acordo
  - Botao "GERAR" que chama a edge function
  - Apos geracao: textarea editavel com o termo completo
  - Botoes "Baixar Word" e "Baixar PDF" no footer
- Funcoes `handleGerarTermo`, `handleDownloadTermoWord` e `handleDownloadTermoPDF` seguindo o mesmo padrao das funcoes existentes de notificacao extrajudicial

### Secao tecnica

**Edge function - prompt da IA:**
- System prompt: "Voce e um advogado brasileiro com mais de 20 anos de experiencia em direito civil e empresarial, especializado em acordos extrajudiciais de cobranca."
- Instrucoes para gerar termo completo com: qualificacao das partes, objeto do acordo, clausulas de pagamento, multas, foro, assinaturas
- Dados do cliente (nome, CPF/CNPJ, credor, valores) enviados junto com a descricao do acordo
- Resposta em texto puro (sem markdown), pronto para formatacao Word/PDF

**Download Word:**
- Mesmo padrao da notificacao extrajudicial (HTML com namespaces Microsoft Office XML)
- Arial 11pt, justificado, margens 2.5cm

**Download PDF:**
- Mesmo padrao da notificacao extrajudicial (jsPDF)
- Fonte Arial, texto justificado

**Modelo IA:** google/gemini-3-flash-preview (default Lovable AI)
**Secret:** LOVABLE_API_KEY (ja configurado)
