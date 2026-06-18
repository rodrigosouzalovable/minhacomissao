## Persistir lista importada e contatados no banco

Hoje a lista de clientes importados e a marcação de "contatado" só ficam salvas no navegador (localStorage). Vou movê-las para o banco, vinculadas à sua conta, para que apareçam iguais em qualquer dispositivo.

### O que muda

1. **Nova tabela** `modelo_mensagem_estado` (1 linha por usuário):
   - `user_id` (PK, dono da linha)
   - `clientes` (JSON com a planilha importada — mesma estrutura de hoje)
   - `contatados` (lista de CPFs marcados)
   - `desc_vista_global`, `desc_parcelado_global`
   - `atualizado_em`
   - RLS: cada usuário lê/escreve apenas a sua própria linha.

2. **Página `ModeloMensagem.tsx`**:
   - Ao abrir, carrega o estado do banco (com fallback para o localStorage existente, só na primeira vez, para não perder o que você já tem hoje).
   - Sempre que `clientes`, `contatados` ou os descontos globais mudarem, faz um `upsert` no banco (com debounce de ~600ms para não gravar a cada tecla).
   - Mantém o localStorage como cache rápido para evitar tela vazia enquanto carrega.

### Resultado
- Importar planilha → fica salva na sua conta.
- Marcar/desmarcar contatado → salvo na sua conta.
- Trocar de aba, fechar o navegador, abrir em outro PC/celular → tudo reaparece igual.

### Fora do escopo
- Compartilhar a mesma lista entre usuários diferentes (cada conta tem a sua).
- Histórico/versões da planilha.
