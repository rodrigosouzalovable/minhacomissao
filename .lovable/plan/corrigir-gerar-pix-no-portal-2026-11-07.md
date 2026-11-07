# Corrigir "Gerar PIX" no portal

## Causa
O acordo do cliente está salvo com o CPF formatado (076.120.972-73), mas o serviço de PIX procura só pelos números (07612097273). Por isso não encontra o acordo e mostra "Não conseguimos gerar o PIX agora" — a UME nem chega a ser chamada. O cadastro UME do cliente existe normalmente.

## Correção
- No serviço do PIX do portal, localizar o acordo aceitando o CPF com ou sem pontuação, sempre ativo e do mesmo cliente.
- Buscar o cadastro UME pelo CPF só com números (como já está salvo).
- Registrar no log o motivo exato quando falhar (acordo não achado, cadastro UME ausente, recusa da UME), para diagnóstico rápido.
- Republicar o serviço e testar com o CPF 076.120.972-73.

Nenhuma regra de valor, parcela ou vencimento muda.

## Detalhes técnicos
`supabase/functions/portal-pix-parcela/index.ts`: trocar `.eq('cliente_cpf', b.cpf)` por `.in('cliente_cpf', [digitos, formatado])`; logs por etapa; deploy e teste via curl.
