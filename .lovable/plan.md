## Objetivo
Permitir importar a planilha `CSIM_TODOS.xlsx` (aba "Planilha1": A = CPF, B = Nome, C = Telefone) em "Importar devedores" para vincular os telefones aos CPFs, de forma que, quando o cliente consultar o CPF no Portal de Negociação, o telefone esteja associado a ele (usado pelo botão de WhatsApp / chatbot / envios).

## Contexto atual (verificado)
- Já existe o layout `pesquisa` em `src/pages/ImportarDevedores.tsx` (linhas 579-596, opção "Pesquisa Cliente"), com o mesmo mapeamento A/B/C.
- Hoje ele grava linhas "vazias" em `public.devedores` (sem dívida) só para carregar o telefone — o que polui a base e não cobre bem o caso do portal, porque cria um novo registro em vez de vincular ao devedor real já cadastrado do CPF.
- Existe a tabela `public.devedor_telefones` (usada pelo Detalhe do Devedor e pelo chatbot para achar CPF por telefone). Ela é o lugar certo para armazenar telefones adicionais por CPF.
- A planilha enviada tem a sheet real chamada `Planilha1` (30.846 linhas). O parser atual pega `SheetNames[0]`, que nesse arquivo é "Cobrança" (vazia). Precisa detectar a melhor sheet.

## O que fazer

### 1. Renomear/rotular a opção para o uso real
- Renomear o rótulo da opção `pesquisa` no seletor para **"Vincular Telefones ao CPF (Portal)"** e ajustar a descrição para: `A = CPF, B = Nome, C = Telefone — vincula o telefone ao CPF já cadastrado, sem criar nova dívida.`
- Manter o valor interno `pesquisa` para não quebrar histórico.

### 2. Detecção de sheet correta
- No branch `pesquisa` do parse, escolher automaticamente a sheet com maior número de linhas (mesma heurística já usada em `pagamentos`), em vez de sempre a primeira. Assim `Planilha1` é encontrada mesmo que exista a sheet "Cobrança" vazia antes.

### 3. Nova lógica de importação (não cria dívida)
No fluxo `importParsedData` quando `credorSelecionado === 'pesquisa'`:
1. Normalizar CPF (11 dígitos, `padStart`) e telefone (só dígitos; se tiver 10/11 dígitos, prefixar `55`).
2. Deduplicar em memória por par (cpf, telefone_sufixo8).
3. Para cada CPF do lote (em blocos de 500):
   - Buscar `devedores` ativos com aquele CPF.
   - Se existir devedor: fazer `upsert` em `devedor_telefones` (por `devedor_id + telefone`) com `origem = 'importacao_portal'`, `nome_contato = nome da planilha` quando o campo estiver vazio; NÃO alterar o `telefone` principal do `devedores` para não sobrescrever manualmente cadastrado.
   - Se NÃO existir devedor daquele CPF: gravar em uma nova tabela leve `devedor_contatos_cpf (cpf, nome, telefone, criado_por, created_at)` como agenda de contatos por CPF — o portal e o chatbot passam a consultar essa tabela como fallback.
4. Registrar contadores (vinculados / novos-contatos / ignorados) e exibir toast + linha em `importacoes`.

### 4. Migration
```sql
CREATE TABLE public.devedor_contatos_cpf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  nome text,
  telefone text NOT NULL,
  origem text DEFAULT 'importacao_portal',
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (cpf, telefone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devedor_contatos_cpf TO authenticated;
GRANT ALL ON public.devedor_contatos_cpf TO service_role;
ALTER TABLE public.devedor_contatos_cpf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read"   ON public.devedor_contatos_cpf FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write"  ON public.devedor_contatos_cpf FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por);
CREATE POLICY "admin all"   ON public.devedor_contatos_cpf FOR ALL TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
CREATE INDEX ON public.devedor_contatos_cpf (cpf);
```

### 5. Uso no Portal de Negociação
- No resultado da consulta por CPF (`/consulta/{credor}/{cpf}`), quando os débitos do CPF forem carregados e o botão de WhatsApp/atendimento for exibido, buscar telefones vinculados na ordem:
  1. `devedores.telefone` + `devedor_telefones` (do CPF).
  2. `devedor_contatos_cpf` do CPF (fallback vindo desta importação).
- Também disponibilizar esses telefones para o chatbot e as campanhas via as consultas já existentes por CPF.

### 6. UI de pré-visualização
Ajustar a tabela de preview do modo `isPesquisa` para 3 colunas (CPF / Nome / Telefone) e mostrar contagem "vinculará X telefones em Y CPFs (Z novos contatos)".

## Fora de escopo
- Não altera o parser dos outros layouts.
- Não remove o comportamento antigo de outros credores.
- Não muda regras de negociação/descontos.

## Detalhes técnicos
- Arquivos alterados:
  - `src/pages/ImportarDevedores.tsx` (rótulos, seleção de sheet, novo branch de importação `pesquisa`, preview).
  - `src/pages/ConsultaResultado.tsx` (fallback de telefones para o botão WhatsApp).
  - Nova migration SQL.
- Sem novas dependências.
- Batches de 500 registros com progresso já existente reaproveitado.