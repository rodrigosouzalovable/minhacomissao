## Objetivo

Na aba **Envio Meta Massa** (`/admin/envio-meta`):

1. Permitir importar planilha Excel (`.xlsx` / `.xls` / `.csv`) onde **Coluna A = Telefone** e **Coluna B = Nome**.
2. Permitir, com ou sem Excel (também para a colagem manual), **validar via instância UAZAPI** quem tem WhatsApp e quem não tem, **antes** de disparar — exibindo a separação na tela.

## O que muda na UI

Na seção **"3. Destinatários"** (onde hoje fica só o textarea de colar):

- Novo botão **"Importar Excel"** ao lado do contador de destinatários.
  - Aceita `.xlsx`, `.xls`, `.csv`.
  - Lê Coluna A (telefone) e Coluna B (nome). Ignora cabeçalho automaticamente se a primeira linha não tiver dígitos no telefone.
  - Substitui o conteúdo do textarea por `telefone,nome` em cada linha (mantém compatível com o `parseRecipients` atual).
  - Toast com total importado e quantos foram ignorados por telefone inválido.

Na seção **"4. Delay e disparo"** (onde já existe o seletor "Validar WhatsApp antes do disparo"):

- Adicionar novo botão **"Validar agora"** ao lado do seletor de instância UAZAPI.
  - Só habilitado quando há destinatários e uma instância UAZAPI selecionada.
  - Roda a edge function `check-whatsapp-numbers` (já existente) com os telefones atuais.
  - Resultado vai para um novo bloco **"Resultado da validação"** logo abaixo, com 3 listas colapsáveis:
    - ✅ **Com WhatsApp** (verde) — entrarão no disparo.
    - ❌ **Sem WhatsApp** (vermelho) — serão descartados.
    - ⚠️ **Erro de validação** (amarelo) — opcionalmente incluir/excluir.
  - Botão **"Remover sem WhatsApp do destinatário"** que reescreve o textarea apenas com os válidos.
  - Resultado também é alimentado em `detalhes.semWhatsapp` / `detalhes.erroValidacao` no contexto, igual já acontece no fluxo de disparo.

O fluxo atual do botão **Disparar** continua funcionando: se uma instância UAZAPI estiver selecionada e ainda não houver validação prévia, ele valida na hora (comportamento que já existe hoje).

## Detalhes técnicos

- Usar `xlsx` (SheetJS) — já presente no `package.json` (usado em `parseCobmaisPlanilha.ts`).
- Novo helper `parseExcelPhonesNomes(file: File): Promise<ClienteRow[]>` em `src/pages/EnvioMeta.tsx` (ou pequeno arquivo `src/lib/parseEnvioMetaExcel.ts`).
  - `XLSX.read` → primeira sheet → `sheet_to_json({ header: 1 })`.
  - Linha = `{ telefone: String(row[0]||"").trim(), nome: String(row[1]||"").trim() }`.
  - Pula linhas sem dígitos no telefone; pula primeira linha se telefone for não-numérico (cabeçalho).
  - Normaliza telefone removendo caracteres não dígitos para checagem; mantém o original para envio.
- Reaproveitar a função `validar()` já existente (que invoca `check-whatsapp-numbers`) extraindo-a para ser chamada também pelo novo botão "Validar agora", sem disparar em seguida.
- Persistir o último resultado de validação no estado local da página (não no contexto de envio) para que o usuário possa revisar antes de clicar em Disparar.

## Fora de escopo

- Não muda o backend nem o `send-whatsapp-meta`.
- Não muda a página Modelo Mensagem (já tem fluxo equivalente).
- Não altera contexto `EnvioMetaSendingContext`.
