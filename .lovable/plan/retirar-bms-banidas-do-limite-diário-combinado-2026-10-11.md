# Retirar BMs banidas do limite diário combinado

## Situação confirmada
- O resumo atualmente mostra **62.500** de limite e **42 BMs**, conforme a imagem e a consulta aos dados.
- A soma considera BMs com instâncias Meta ativas, mas não verifica banimentos. Há BMs com todos os seus números marcados como banidos e uma BM com apenas parte dos números banidos.

## Alteração proposta
1. Excluir do resumo a cota de uma BM com banimento confirmado pela Meta. Quando o bloqueio for apenas de um número ou de uma conta WhatsApp dentro da BM, preservar a cota da BM se houver outra instância ativa sem banimento.
2. Recalcular **Limite combinado**, **Disponível** e a quantidade de BMs consideradas com o mesmo conjunto elegível, contando cada BM apenas uma vez. Exemplo: uma BM banida com cota de **250** retira **250** do limite; um total de **62.500** passaria a **62.250** nesse cenário.
3. Não excluir BMs somente por qualidade **RED/YELLOW**, aviso **LIMITED**, pagamento inconclusivo ou falha de consulta. Não apagar cadastros, cotas configuradas nem histórico de envios.
4. Atualizar o resumo após a verificação de saúde já existente e ao carregar novamente a página. Se a Meta confirmar a retirada do banimento e houver instância ativa elegível, a BM volta a contribuir com sua cota.

## Detalhes técnicos
- Ajustar somente o cálculo de apresentação na API Oficial Meta, preservando a função compartilhada de cotas e as regras de envio das campanhas.
- Isolar o cálculo em uma função testável. Usar os dados completos autorizados já carregados, antes dos filtros visuais, para não confundir uma lista parcial com uma BM totalmente banida.
- Conferir a entidade e o identificador dos avisos Meta: banimento BUSINESS afeta a BM correspondente; banimento WABA ou PHONE_NUMBER afeta apenas a conta ou o número correspondente.
- Reutilizar as consultas existentes, sem novo agendamento, polling ou aumento do volume de envios.

## Validação
- Testar a retirada exata de **250**, a soma única por BM, banimento total e parcial, BM ilimitada banida e retorno após desbloqueio confirmado.
- Testar que RED/YELLOW, LIMITED e consultas inconclusivas não retiram a cota por si só.
- Conferir o resumo na página e executar os testes relacionados, sem enviar mensagens reais.