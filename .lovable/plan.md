## Adicionar seleção de instância WhatsApp ao criar acordo

Adicionar uma nova seção logo abaixo do seletor de "Empresa" (credor) na tela **Novo Acordo** para que você selecione qual das suas instâncias WhatsApp foi usada para negociar com o cliente.

### O que muda

**1. Banco de dados**
- Nova coluna opcional `instancia_negociacao_id` na tabela `acordos` referenciando `user_whatsapp_instances(id)`.
- Sem alteração de RLS — herda das políticas existentes.

**2. UI — `src/pages/NovoAcordo.tsx`**
- Novo bloco logo abaixo do seletor "Empresa", com Label "Instância WhatsApp da negociação" e botões (mesma estética dos botões de empresa) listando as instâncias ativas do usuário (`user_whatsapp_instances` filtrando `user_id = auth.uid()` e `ativo = true`), exibindo `nome` (ou `telefone` como fallback).
- Campo opcional — pode ficar sem seleção.
- O id selecionado é salvo em `instancia_negociacao_id` no insert do acordo.

**3. UI — `src/pages/NovoAcordoAdmin.tsx`**
- Mesmo seletor adicionado na tela de admin (lista todas as instâncias ativas, sem filtro de user_id), para consistência. Se preferir só na tela do funcionário, me avise.

### Fora do escopo
- Não exibir/editar o campo em outras telas (detalhe, edição, listagens) — pode ser feito em pedido futuro.
- Não usar a instância automaticamente para envios — é apenas registro de qual número negociou.
