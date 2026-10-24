# Corrigir falha no acordo do portal — CPF 009.667.424-51 (Abdias, Odres Cred)

## O que já foi verificado
- O cliente está na carteira Odres Cred importada (borrowerId 16381579, 9 parcelas de R$ 152,60, principal R$ 1.373,00, 188 dias de atraso).
- Não há acordo ativo dele no sistema.
- As tentativas no portal ocorreram às 09:46 (2 tentativas seguidas), mas **nenhuma chegou a fechar acordo na UME nem a pedir PIX**: não há registro de fechamento nem de boleto. Isso bate com o backoffice sem acordo.
- A tela do portal parou num motivo de recusa anterior ao fechamento, e hoje esses motivos não ficam registrados, por isso não dá para saber qual foi (limite de tentativas, credor/carteira, data, valor mínimo de parcela ou simulação da UME).

## O que será feito
1. Registrar toda tentativa do portal com o motivo exato da recusa (sem dados sensíveis além do CPF já usado), inclusive a resposta da UME na simulação.
2. Refazer a simulação deste CPF em produção **sem fechar acordo nem gerar boleto**, para descobrir o motivo real.
3. Corrigir conforme a causa:
   - Se for a segunda tentativa bloqueada pelo limite de tentativas: não contar como nova tentativa quando o mesmo pedido é repetido em poucos segundos (clique duplo).
   - Se a UME recusar a simulação (ex.: dívida atualizada menor que o total, prazo ou data): mostrar ao cliente uma mensagem clara e ajustar o cálculo para o valor aceito pela UME.
   - Se o credor escolhido não bater com a carteira: identificar o credor pela carteira importada.
4. Mostrar no portal uma mensagem específica por motivo, em vez da mensagem genérica.
5. Testar de novo só com simulação; o fechamento real fica para você confirmar.

## Detalhes técnicos
- `portal-efetivar-acordo`: `console.log` + insert em `ume_acordo_api_log` (acao `portal_recusa`, motivo, status UME) em todos os `return fallback/json` antes do fechamento.
- Rate limit `portal_reservar_consulta`: deduplicar requisições idênticas em janela curta.
- Sem novos crons/polling; custo desprezível.
