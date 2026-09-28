# Data de abertura e distribuição do Certificado

## Resultado
- Na caixa CERTIFICADO, substituir “Credor: definir” por “Abertura do CNPJ: DD/MM/AAAA” quando houver lead correspondente.
- Manter o seletor de credor nas demais caixas.
- Redistribuir os contatos pendentes da campanha entre todas as instâncias com “Aquecimento Certificado” realmente aptas.

## Regras preservadas
- Usar somente leads da Casa dos Dados; Google Maps continua desligado.
- Não usar instâncias YELLOW/RED, pausadas, fora do pool, sem vínculo ou sem o template aprovado.
- Respeitar até 50 mensagens por instância e o teto conjunto de R$120 por dia.
- Manter deduplicação por número e não repetir destinatários já reservados ou enviados.

## Implementação técnica
- Buscar as datas de abertura em lote para os contatos visíveis da caixa CERTIFICADO, reaproveitando a atualização atual da Inbox e sem novo polling.
- Ajustar o cabeçalho da conversa para renderizar a data encontrada.
- Reatribuir somente itens ainda pendentes e sem instância, distribuindo-os pelas cotas restantes das instâncias aptas.
- Conferir campanha, contagens, tela da Inbox e erros após a execução.
