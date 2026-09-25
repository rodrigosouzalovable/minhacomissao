# Nome com underline e envio direto em lote de Templates Meta

## O que muda
- Em **Criar Template**, cada espaço digitado no nome será convertido imediatamente em `_`. A validação de nome repetido continuará funcionando sobre o nome já convertido; outros caracteres inválidos continuarão bloqueados como hoje.
- Em **Aplicar em Lote**, **Enviar para todas agora** ficará disponível também para modelos **MARKETING**, sem precisar enviar um piloto nem aguardar a aprovação dele. O envio ocorrerá **somente quando você clicar no botão**, para os números selecionados e elegíveis — não automaticamente ao salvar o modelo.
- Manter os botões de piloto e replicação como alternativas opcionais. Ajustar o aviso da tela para mostrar que o piloto é recomendável, mas não obrigatório, e que a aprovação é decidida individualmente pela Meta.

## Proteções preservadas
- Antes do envio, continuam as verificações de variáveis, exemplos, mídia e categoria, além do limite de **2 submissões de templates por número/dia para tier 250** e da exclusão dos números de parceiros aplicada no processamento atual.
- A alteração é apenas na **submissão de templates para aprovação**. Não libera disparos MARKETING para clientes, não inicia campanhas e não retoma a prospecção de Certificado pausada.
- **Risco de rejeição em massa:** se o texto for recusado, a mesma versão poderá ser recusada em todos os números escolhidos. Ao dispensar o piloto, esse risco é assumido no clique de envio.

## Aviso de custo Lovable Cloud
O botão reaproveita a função existente: **nenhum novo agendamento, polling, tabela ou rotina contínua**. Um clique pode submeter até uma vez por número escolhido (na imagem, até 83 antes dos filtros), usando processamento já existente; o consumo por lote aumenta proporcionalmente ao número selecionado. A aprovação do plano autoriza esse envio direto como opção, **mas não executará nenhum lote agora**.

## Detalhes técnicos e validação
- Em `src/pages/MetaTemplates.tsx`, normalizar espaços no `onChange` do nome; remover a desabilitação por categoria MARKETING do botão de envio direto e atualizar o texto do fluxo.
- Em `supabase/functions/meta-criar-template-lote/index.ts`, aceitar a chamada direta sem `modo` para MARKETING, preservando todas as demais validações e a proteção tier 250; manter a aprovação exigida apenas no modo opcional de replicação.
- Verificar digitação, nome duplicado e estados dos botões para UTILITY/MARKETING; testar a validação sem enviar um template real à Meta nem disparar mensagens.
