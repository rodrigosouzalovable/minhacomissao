# Download de planilhas após Verificação de WhatsApp

## Contexto
Na página `/admin/acionamento`, após clicar em **Verificar WhatsApp**, o sistema já separa os contatos em dois grupos:
- `clientes` (válidos — têm WhatsApp)
- `numerosInvalidos` (sem WhatsApp)

Hoje só é possível ver os números removidos numa lista interna. Vamos adicionar **dois botões de download Excel** que aparecem assim que a verificação terminar.

## Mudanças

### `src/pages/Acionamento.tsx`

1. **Importar utilitário existente** `exportarParaExcel` de `@/lib/exportExcel` (já presente no projeto, usa XLSX).

2. **Criar duas funções de download** logo acima do JSX do card "Importar Planilha":
   - `handleDownloadComWhatsApp()` — exporta `clientes` (válidos) com colunas: CPF, Nome, Telefone, Atraso, Saldo. Nome do arquivo: `contatos-com-whatsapp-YYYY-MM-DD.xlsx`.
   - `handleDownloadSemWhatsApp()` — exporta `numerosInvalidos` com as mesmas colunas. Nome do arquivo: `contatos-sem-whatsapp-YYYY-MM-DD.xlsx`.

3. **Adicionar 2 botões na UI** dentro do bloco `verificacaoConcluida`:
   - Botão verde **"⬇ Baixar com WhatsApp (N)"** — sempre visível após verificação se `clientes.length > 0`.
   - Botão âmbar **"⬇ Baixar sem WhatsApp (N)"** — visível se `numerosInvalidos.length > 0`.
   
   Posicionados como uma linha de ações no `Alert` de resultado, ao lado do botão "Ver números removidos". Quando todos têm WhatsApp (alerta verde), mostrar apenas o botão de baixar com WhatsApp.

## Detalhes técnicos
- Uso do helper `exportarParaExcel<T>(dados, colunas, nomeArquivo)` mantém consistência com o resto do app.
- Nenhum custo de Cloud (geração 100% client-side via SheetJS já bundled).
- Sem alterações de DB, edge functions ou estado persistente.
- Persistência do `numerosInvalidos` mantida em memória até nova importação/verificação (comportamento atual já preservado).
