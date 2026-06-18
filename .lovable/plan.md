## Mudanças em `src/pages/ModeloMensagem.tsx`

**Tabela "2. Clientes & Propostas"** — reduzir para 3 colunas:
1. **Cliente** (nome completo, como hoje)
2. **Telefone** — número + botão "Copiar" ao lado (ícone)
3. **Mensagem** — preview com `line-clamp-3` + botão "Copiar" ao lado

Remover colunas: CPF, Contrato, Total, Parc., % à vista, Nx, % Nx, Ações (Eye).
Manter o `Sheet` de preview? Não — sem coluna Ações. Remover preview lateral e estado `previewCpf`/`clientePreview`.

As configurações globais (% à vista, Nx, % parcelado, Aplicar a todos) **permanecem** no card 1 — só não são mais editáveis por linha. O cálculo de `calcMaxParcelas` continua sendo aplicado por cliente automaticamente.

## Mudanças em `src/lib/parseCobmaisPlanilha.ts`

**Nova coluna F "DIAS EM ATRASO"** na aba Cobrança:
- Adicionar `diasAtraso: number` em `ClienteImportado`.
- Em `parsePlanilhaCobmais`, localizar com `findCol(cobH, 'DIAS EM ATRASO', 'DIAS ATRASO', 'DIAS')`. Se não achar, usar índice 5 (coluna F) como fallback. Parsear com `Number(...) || 0`.

**Template e render** — novo placeholder `{dias_atraso}`:
- Adicionar `'{dias_atraso}': String(cliente.diasAtraso)` no map.
- Atualizar `TEMPLATE_PADRAO` em `ModeloMensagem.tsx`:
  ```
  Identificamos {qtd_parcelas_atraso} parcelas em aberto a {dias_atraso} dias de atraso no contrato {contrato}, totalizando *R$ {total_atraso}*.
  ```
- Trocar `{nome}` por **primeiro nome**: criar placeholder `{primeiro_nome}` = `cliente.nome.split(' ')[0]` e usar no template padrão. Manter `{nome}` funcionando.

## Fora do escopo
- Não mexer em RLS/backend, parser das outras abas (Telefones/Parcelas), nem no `EditarTemplateMensagemDialog`.
