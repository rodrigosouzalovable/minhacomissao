
## Objetivo

No botão **"Importar planilha"** da aba Relatórios, permitir escolher entre **3C Plus Discador** (fluxo atual) ou **Relatório CobMais** (novo). O CobMais alimenta automaticamente Tentativas, WhatsApp, Alô, CPC e CPC-A no quadro horário.

## Regras de mapeamento CobMais (confirmadas)

Cada linha = 1 evento (Data, Hora, Evento, CPF/CNPJ, Nome, Valor em Atraso). Cabeçalhos de Equipe/Operador e linhas sem CPF/Hora são ignorados.

| Evento (case-insensitive, normalizado) | Tentativas | WhatsApp | Alô | CPC | CPC-A |
|---|:-:|:-:|:-:|:-:|:-:|
| Qualquer linha com CPF válido | +1 | | | | |
| Evento contendo `whatsapp` (ex.: "Envio de WhatsApp") | (já +1 acima) | **+1** | **+1** | | |
| `contato com cliente` | (já +1) | | **+1** | **+1** | |
| `acordo` | (já +1) | | **+1** | **+1** | **+1** |
| `boleto gerado`, `alteração de boleto`, `2ª via`, etc. | (já +1) | | **+1** | **+1** | **+1** |
| Demais eventos (sem contato, caixa postal, número inválido, etc.) | (já +1) | | | | |

Resumo das regras confirmadas:
- **Tentativas** = toda linha com CPF (todas as discagens).
- **WhatsApp** = qualquer evento que contenha "whatsapp"; também soma em Alô.
- **Alô** = recebe CPC, CPC-A, WhatsApp, Boleto Gerado e Alteração de Boleto.
- **CPC** = Contato com Cliente, Acordo, Boleto Gerado, Alteração de Boleto.
- **CPC-A** = Acordo, Boleto Gerado, Alteração de Boleto.

Hora extraída do campo Hora (HH:MM) → faixa `Hh-(H+1)h`. Fora de 8h–18h é ignorado. Data alvo detectada da maioria das linhas e editável antes de confirmar.

## Mudanças (apenas frontend)

### `src/components/relatorios/ImportarLigacoesDialog.tsx`
- **Passo 0**: `RadioGroup` para escolher a origem — `3c` (atual) ou `cobmais` (novo).
- Manter `handleFile3C` (parser atual intacto) e criar `handleFileCobmais`:
  - Lê com `xlsx` (sheet 1, `header:1`), localiza a linha de cabeçalho contendo "Data", "Hora", "Evento", "CPF/CNPJ".
  - Para cada linha de evento aplica o mapeamento acima e incrementa `contagem[faixa]` (`tentativas`, `whatsapp`, `alo`, `cpc`, `cpca`).
- Estender o tipo `Resumo` e a tabela de pré-visualização para 5 colunas quando a origem for CobMais.
- `confirmar()`: fazer upsert das 5 colunas em `relatorio_acionamentos` e registrar logs em `relatorio_acionamentos_log` (mesmo padrão atual: uma linha de log por coluna alterada, `acao = 'importacao_cobmais_<coluna>'`).
- Manter modos **Substituir** / **Somar** e o intervalo de horas.
- Coluna `acordos_valor` continua intocada (alimentada só pelo trigger de criação de acordos).

## Sem mudanças
- Backend, schema, RLS, edge functions, cron, storage — nada altera.
- Importação 3C Plus segue idêntica.
- Nenhum custo adicional de Lovable Cloud.
