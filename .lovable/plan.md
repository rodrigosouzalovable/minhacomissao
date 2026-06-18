# Modelo Mensagem — Importador de Planilha

Substitui o fluxo atual de print/IA por um importador da planilha exportada do Cob+ (`Pesquisa-Cliente-*.xlsx`). O sistema lê as abas `Cobrança`, `Telefones` e `Parcelas`, junta tudo por CPF e gera uma mensagem pronta de negociação para cada cliente.

## Layout da aba `/modelo-mensagem`

```
┌───────────────────────────────────────────────────────────────────────┐
│ [Importar planilha .xlsx]   [Editar modelo da mensagem]               │
│ Desconto padrão à vista: [50] %    Parcelado: [12] x  com [30] %      │
├───────────────────────────────────────────────────────────────────────┤
│ Tabela (uma linha por CPF)                                            │
│ Cliente │ CPF │ Telefone │ Contrato │ Total │ Parc. │ %1x │ Nx │ %Nx │ [Copiar] [Ver msg]
└───────────────────────────────────────────────────────────────────────┘
```

Painel direito (drawer) abre ao clicar “Ver msg”: preview da mensagem renderizada + botão Copiar.

## Parsing da planilha (no browser, via `xlsx` já instalado)

Localiza colunas pelo **nome do cabeçalho** (case-insensitive, trim) — não por letra fixa, para sobreviver a mudanças de ordem.

- **Cobrança** → `CPF/CNPJ`, `CLIENTE`, `CONTRATO`, `TOTAL ATRASO`
- **Telefones** → `CPF/CNPJ`, `NUMERO`, `CONTATO`. Mantém só linhas onde `CONTATO = SIM`. Usa o **primeiro SIM** por CPF.
- **Parcelas** → `CPF/CNPJ`, `CONTRATO`, `NUMERO`, `VENCIMENTO`, `VALOR`. Agrupa por CPF.

Normaliza CPF (só dígitos) e telefone (só dígitos, prefixa `55` se faltar).

Resultado: array `ClienteImportado[]` com `{ cpf, nome, contrato, telefone, totalAtraso, parcelas: [{numero, vencimento, valor}] }`.

## Cálculos por linha

- `qtd_parcelas = parcelas.length`
- `valor_parcela_aberto = totalAtraso / qtd_parcelas` (já vem na planilha, mas usamos a soma real)
- `valor_quitacao = totalAtraso * (1 - %1x/100)`
- `valor_parcelado_total = totalAtraso * (1 - %Nx/100)`
- `valor_cada_parcela_proposta = valor_parcelado_total / Nx`

Cada linha herda os defaults globais (%1x, Nx, %Nx) mas tem inputs editáveis.

## Template da mensagem (singleton em `modelo_mensagem_template`)

Reaproveita a tabela já criada. Adiciono variáveis novas:

- `{nome}` `{cpf}` `{contrato}` `{telefone}`
- `{total_atraso}` `{qtd_parcelas_atraso}` `{valor_parcela_aberto}`
- `{lista_parcelas}` (• Parcela 01 — venc. 15/11/2023 — R$ 350,00)
- `{desconto_vista_pct}` `{valor_quitacao}`
- `{parcelado_qtd}` `{desconto_parcelado_pct}` `{valor_cada_parcela_proposta}` `{valor_parcelado_total}`
- `{data_hoje}`

Modelo default sugerido (editável pelo dialog já existente):

```
Olá {nome}, tudo bem? Sou da Souza & Ribeiro.

Identifiquei seu contrato {contrato} com total em aberto de {total_atraso}
({qtd_parcelas_atraso} parcelas pendentes).

Tenho duas propostas para hoje:

• À vista: {valor_quitacao} ({desconto_vista_pct}% de desconto)
• Parcelado em {parcelado_qtd}x de {valor_cada_parcela_proposta}
  (total {valor_parcelado_total}, {desconto_parcelado_pct}% de desconto)

Posso gerar o boleto agora?
```

## Arquivos

**Reescrever:**
- `src/pages/ModeloMensagem.tsx` — remove dropzone de imagem, remove chamada à edge `extract-cobmais-print`. Adiciona upload `.xlsx`, parser, tabela editável, drawer de preview.

**Novo:**
- `src/lib/parseCobmaisPlanilha.ts` — funções puras: `parsePlanilha(file): Promise<ClienteImportado[]>` e `renderTemplate(template, ctx): string`.

**Não muda:**
- `EditarTemplateMensagemDialog.tsx` (só adiciono as novas variáveis à lista de ajuda).
- Tabela `modelo_mensagem_template` (já cobre).
- Edge function `extract-cobmais-print` permanece deployada mas deixa de ser chamada (não removo para evitar perda; aviso no chat).

## Fora de escopo

- Envio via WhatsApp direto da aba (continua copiar/colar).
- Histórico de planilhas importadas.
- Validação cruzada com base de devedores existente.
- Suporte a múltiplos contratos por CPF (uso o `CONTRATO` que vier em Cobrança; se houver mais de um, mostro o primeiro e sinalizo na UI).
