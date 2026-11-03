# Disparo continua sem os números de qualidade baixa

## O que acontece hoje
O aviso não fala dos clientes. Ele fala de 2 **números de envio** que você marcou (SOUZA 62 8269-8247 e SOUZA 62 8267-7298), que estão com qualidade YELLOW na Meta. A tela só pede confirmação de risco quando já sabe dessa qualidade. Como a informação da tela estava desatualizada, o pedido não apareceu. Na hora de iniciar, o sistema consultou a Meta, viu a qualidade YELLOW e recusou a campanha inteira.

## O que vai mudar
- Quando o sistema encontrar números de envio YELLOW/RED que você não confirmou, ele **tira esses números** e **inicia a campanha** com os outros números selecionados.
- Aparece um aviso amarelo, por exemplo: "Campanha iniciada sem 2 número(s) com qualidade baixa: SOUZA 62 8269-8247 (YELLOW), SOUZA 62 8267-7298 (YELLOW)."
- Os clientes da lista não mudam. Os 3.718 contatos são distribuídos entre os números que sobraram.
- A campanha só é recusada se todos os números selecionados estiverem com qualidade baixa. Nesse caso, o aviso explica o motivo.
- Continua igual: se você confirmar o risco no aviso da tela, esses números entram na campanha.

## Detalhes técnicos
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: quando houver `arriscadas` e faltar `riscoQualidadeConfirmado`, o sistema tira esses números de `instanciaIdsFiltradas` em vez de responder 400. Ele responde 400 só se não sobrar nenhum número. A resposta de sucesso passa a incluir `instancias_excluidas_qualidade`.
- `src/pages/EnvioMeta.tsx`: depois de iniciar com sucesso, se vier `instancias_excluidas_qualidade`, mostra um `toast.warning` com os nomes.
- Publicar a função de início de campanhas novamente.
