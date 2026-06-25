## Objetivo
Permitir, na aba **Modelo Mensagem → Importar planilha**, subir planilhas no formato simples como `CNAO RODRIGO.xlsx`:

- Coluna A: Nome do cliente
- Coluna B: Telefone
- Coluna C: Dias de atraso
- Coluna D: Valor total em aberto
- Sem cabeçalho, dados a partir da linha 1

O sistema deve detectar automaticamente esse layout (além do layout Cob+ atual de 3 abas) e gerar a mensagem usando o mesmo template/descontos já configurados.

## Mudanças

### 1. `src/lib/parseCobmaisPlanilha.ts`
- Detectar o formato:
  - Se o workbook tiver as abas `Cobrança` / `Telefones` / `Parcelas` → usar parser atual (Cob+).
  - Caso contrário, tratar a primeira aba como **layout simples**.
- Novo parser interno `parsePlanilhaSimples(wb)`:
  - Lê linha a linha da primeira aba.
  - Detecta automaticamente se a primeira linha é cabeçalho (texto em todas as colunas) e pula.
  - Mapeia: A=nome, B=telefone (normalizado via `normalizePhone`), C=diasAtraso, D=totalAtraso.
  - Sem CPF disponível → gera chave sintética `sim-<idx>-<telefone>` para preencher `cpf` (mantém unicidade na UI).
  - `contrato = ''`, `parcelas = []`, `telefones = [telefone]`.
  - Ignora linhas sem telefone ou sem valor.
- Exporta a mesma `ClienteImportado[]` — nenhuma mudança no consumidor.

### 2. `src/pages/ModeloMensagem.tsx`
- Atualizar o texto de ajuda do bloco "1. Importar planilha" para mencionar os dois formatos aceitos:
  - Cob+ (abas Cobrança/Telefones/Parcelas)
  - Simples (Nome | Telefone | Dias Atraso | Valor Total)
- Nenhuma mudança em `handleFile` (o parser passa a aceitar ambos os formatos transparentemente).

### 3. Renderização da mensagem
- `renderMensagem` em `parseCobmaisPlanilha.ts` continua o mesmo. Para o layout simples:
  - `{lista_parcelas}` fica vazio (sem dados de parcelas) — usuário pode ajustar o template ou continuar usando as variáveis principais (`{nome}`, `{primeiro_nome}`, `{total_atraso}`, `{dias_atraso}`, `{valor_quitacao}`, `{opcoes_parcelado}`, `{valor_cada_parcela_proposta}`, etc., que dependem só de `totalAtraso` e dos descontos globais já configurados).
  - `{qtd_parcelas_atraso}` retorna 0; `{valor_parcela_aberto}` cai no fallback `total/1 = total`.

## Fora de escopo
- Não altera template padrão nem a lógica de envio/validação WhatsApp.
- Não toca em banco de dados.

## Validação manual
1. Importar o arquivo `CNAO RODRIGO.xlsx` na aba Modelo Mensagem.
2. Conferir contagem de clientes (~361 linhas) e amostra de mensagens Msg 1/Msg 2 com nome, valor e desconto corretos.
3. Importar uma planilha Cob+ existente para garantir que o fluxo antigo continua funcionando.
