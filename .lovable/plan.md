## Objetivo

Permitir dois modelos de mensagem ("Mensagem 1" e "Mensagem 2") no botão **Editar Modelo**, cada um com seu próprio botão **Salvar**, e exibir na tabela "2. Clientes & Propostas" **dois botões de copiar** por linha — um para cada mensagem.

## Mudanças

### 1. Banco (`modelo_mensagem_template`)
Adicionar colunas para o segundo template:
- `template_2 text`
- `desconto_padrao_2 numeric`
- `desconto_parcelado_padrao_2 numeric`
- `parcelas_padrao_2 integer`

(O `template` atual vira "Mensagem 1"; novas colunas guardam "Mensagem 2". Sem alterações em RLS.)

### 2. `EditarTemplateMensagemDialog.tsx`
- Adicionar `Tabs` internas: **Mensagem 1** / **Mensagem 2**.
- Cada aba tem seu próprio textarea + 3 campos (% desconto à vista, % desconto parcelado, nº parcelas) + **botão "Salvar Mensagem 1"** / **"Salvar Mensagem 2"** independentes.
- Cada Salvar grava só os campos da aba ativa (`upsert` parcial) e dispara um callback separado (`onSaved1` / `onSaved2`).
- Variáveis disponíveis continuam compartilhadas no topo.

### 3. `ModeloMensagem.tsx`
- Novos estados: `template2`, `descVistaGlobal2`, `descParceladoGlobal2`, `parceladoQtdGlobal2` (defaults = mesmos da Mensagem 1).
- Carregar e persistir as novas colunas junto do template existente.
- Função `mensagemDoCliente2(c)` que renderiza com os parâmetros do template 2.
- Na coluna **Mensagem** da tabela, mostrar **duas linhas/botões**:
  - Botão "Copiar Mensagem 1" (com preview/tooltip da msg 1)
  - Botão "Copiar Mensagem 2" (com preview/tooltip da msg 2)
- Atualizar toast para indicar qual mensagem foi copiada.
- O cabeçalho da coluna passa a ser "Mensagens".

### Fora de escopo
- Aba "Colar imagem" continua usando só a Mensagem 1 (sem mudanças).
- Sem alteração na lógica de validação WhatsApp, filtros, contadores.

## Detalhes técnicos
- Se `template_2` vier `null` do banco, usar o mesmo `TEMPLATE_PADRAO` como fallback inicial.
- O `EditarTemplateMensagemDialog` recebe ambos templates como props e dois callbacks `onSaved1` / `onSaved2`.
- Migration usa `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — sem novas policies (a tabela já tem RLS por `user_id`).
