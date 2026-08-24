# Inbox Meta: janela 24h como ícone + Modelo abre na aba do credor

## 1. Selo da janela de 24h vira ícone

No cabeçalho da conversa, o badge com texto ("Aberta · fecha em 3 horas", "Janela fecha em 40 minutos", "Fechada · envio bloqueado") passa a ser apenas um ícone quadrado do mesmo tamanho dos outros botões do cabeçalho (Qualificação, Modelo, Agendar retorno, Não precisa resposta):

- Aberta: ícone de relógio verde.
- Fecha em menos de 1h: ícone de alerta âmbar pulsante.
- Fechada: ícone de alerta vermelho.

Ao passar o mouse, um tooltip mostra a informação completa que hoje aparece no texto, incluindo o tempo restante ("Janela 24h aberta · fecha em 3 horas", "Janela fecha em 40 minutos", "Janela fechada · envio livre bloqueado").

Os avisos maiores que já aparecem acima da caixa de digitação (faixa vermelha de janela encerrada e faixa âmbar de atenção) continuam como estão, então nenhuma informação é perdida.

## 2. Ícone Modelo abre direto na aba do credor

Quando a conversa tem credor definido no cabeçalho:

- Credor UME: o diálogo de Modelo Mensagem abre já na aba "Layout UME".
- Credor Novo Mundo: abre já na aba "Layout Novo Mundo".
- Sem credor definido: abre na aba "Layout Novo Mundo" (comportamento atual).

O atendente continua podendo trocar de aba manualmente. Se ele alterar o credor no cabeçalho e reabrir o Modelo, a aba correta é reaplicada.

## Detalhes técnicos

- `src/components/modelo-mensagem/ModeloMensagemDialog.tsx`: nova prop opcional `credor?: string | null`; a aba passa a ser estado controlado (`value`/`onValueChange`), inicializado por `credor === 'ume' ? 'layout-ume' : 'imagem'` e ressincronizado quando o diálogo abre.
- `src/pages/InboxMeta.tsx`: passar `credor={contatoAtivo?.credor}` no `<ModeloMensagemDialog />`; substituir os três `Badge` de `janelaInfo` (linhas ~2218-2230) por um único botão/ícone com `Tooltip` (`TooltipProvider`/`TooltipTrigger`/`TooltipContent` do shadcn, já disponível no projeto) mantendo o mesmo cálculo de `janelaInfo` e `formatDistanceToNowStrict`.
- Sem mudanças de banco, sem novas funções, sem cron, sem realtime: custo de backend inalterado.
