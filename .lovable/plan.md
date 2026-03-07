

## Disponibilizar código do server.js na página de Automação CobMais

O usuário quer visualizar e copiar o código do `server.js` diretamente na interface da página `/admin/automacao-cobmais`, sem precisar abrir arquivos locais.

### Plano

Adicionar uma nova aba **"Código do Robô"** no componente `AutomacaoCobMais.tsx` (junto às abas de Comandos/Logs, ou como um card dedicado) que:

1. Exibe o código completo do `server.js` em um bloco `<pre><code>` com scroll, fundo escuro (estilo terminal)
2. Inclui um botão **"Copiar Código"** que copia todo o conteúdo para a área de transferência
3. Mostra instruções rápidas: `npm install express playwright cors` e `node server.js`

### Arquivo a modificar
- `src/pages/AutomacaoCobMais.tsx` — adicionar uma seção/card com o código do server.js como string literal e botão de copiar

