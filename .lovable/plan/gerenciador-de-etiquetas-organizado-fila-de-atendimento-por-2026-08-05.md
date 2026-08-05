# Gerenciador de etiquetas organizado + fila de atendimento por caixa

## 1. Deixar a janela "Etiquetas Meta" enquadrada e organizada

Hoje o conteúdo estoura a janela: a lista rola dentro de um bloco pequeno, o formulário de criação ocupa metade do espaço e etiquetas automáticas de atendente ficam misturadas com as manuais.

Mudanças visuais:
- Altura fixa da janela com cabeçalho e rodapé fixos e apenas a lista rolando (nada mais vaza para fora).
- Criação de etiqueta recolhida em um botão "Nova etiqueta" no topo; abre um bloco compacto (nome + paleta de cores em uma linha).
- Lista dividida em dois grupos com títulos: **Atendentes** (etiquetas automáticas) e **Etiquetas gerais**, cada grupo com contador.
- Campo de busca por nome quando houver muitas etiquetas.
- Linhas padronizadas: bolinha de cor, nome truncado, e ações (lápis / lixeira) sempre alinhadas à direita.
- Edição inline mais enxuta: nome + paleta na mesma linha, com Salvar/Cancelar; erro de permissão continua avisando por toast.

Todas as etiquetas (incluindo as de atendente e as criadas por outros usuários) continuam listadas aqui para renomear e trocar a cor.

## 2. Fila de atendimento distribuindo as conversas respondidas

A distribuição automática já existe (round-robin por menor carga entre os responsáveis da caixa), mas está incompleta: dos 11 vínculos de operadores em caixas, **7 não têm etiqueta "Atendente: <nome>"** e a fila tem apenas 8 registros ativos. Quem não tem etiqueta nunca entra no sorteio, então parte das conversas respondidas fica sem responsável.

O que será feito:
- Ao vincular operadores a uma caixa de mensagens, o sistema cria automaticamente a etiqueta "Atendente: <nome>" (com cor automática da paleta) e o registro correspondente na fila, se ainda não existirem.
- Preenchimento retroativo para os vínculos já existentes, para que todas as caixas passem a distribuir corretamente hoje.
- A regra de distribuição permanece: quando o cliente responde, a conversa recebe um único atendente, escolhido entre os responsáveis daquela caixa, sempre o de menor carga.
- A janela de vínculo de operadores mostra um aviso quando um operador ainda não estiver na fila.

## Detalhes técnicos

- `src/components/inbox/meta/MetaEtiquetasDialog.tsx`: reestruturar layout (`max-h-[85vh]`, `flex flex-col`, área de lista com `flex-1 overflow-y-auto`), agrupar por `^Atendente:`, busca local, formulário de criação em estado recolhido, edição inline compacta.
- `src/components/inbox/meta/MetaFolderAcessoDialog.tsx`: após salvar membros, chamar RPC de provisionamento e exibir badge "fora da fila" para membros sem etiqueta.
- Migração: RPC `meta_provisionar_atendentes_fila(_folder uuid)` (security definer) que, para cada membro da caixa (ou `meta_inbox_default_members` quando `_folder is null`), garante `meta_whatsapp_etiquetas` com nome `Atendente: <profiles.nome>` e `meta_atendimento_fila` ativo; execução única de backfill para todos os vínculos atuais. `atribuir_atendente_fila()` fica como está.
