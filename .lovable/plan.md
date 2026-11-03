# Reativar campanhas canceladas

## Problema
Hoje o botão "Reativar" de uma campanha cancelada sempre falha. O sistema bloqueia de propósito ("Campanhas canceladas não podem ser reativadas"), e a tela mostra só "Erro ao reativar".

## O que muda
- Clicar em "Reativar" numa campanha cancelada (ex.: ODRES, 3.973 pendentes) volta a enviar de onde parou.
- Só vão os clientes que ainda não receberam. Quem já recebeu não recebe de novo.
- Continuam valendo as mesmas regras de hoje: blacklist, envio recente, cota da BM, qualidade e instâncias bloqueadas.
- Se a campanha não tiver mais ninguém pendente, ela fica como concluída e aparece um aviso claro.
- Se a reativação falhar por outro motivo, a tela mostra o motivo real, não só "Erro ao reativar".

## Detalhes técnicos
- `supabase/functions/envio-meta-massa-control/index.ts`: remover o retorno 409 para `status === 'cancelado'` na ação `reativar`; o fluxo atual já reconcilia contadores, devolve erro/falha/processando para pendente, redistribui instâncias bloqueadas e atualiza para `rodando` com `concluido_em: null`.
- `src/pages/EnvioMeta.tsx` / `EnvioMetaSendingContext.tsx`: mostrar no aviso a mensagem de erro que o servidor devolve.
- Publicar a função de novo e testar reativando a campanha ODRES cancelada.
