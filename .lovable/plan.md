# Experimento por idade do CNPJ no Certificado Digital

## Objetivo
Executar uma sequência controlada de 50 contatos por dia útil para descobrir qual idade do CNPJ gera mais respostas, sem aumentar o limite atual.

## Implementação
- Programar a sequência D+5, D+10, D+15, D+20, D+25 e D+30, iniciando amanhã.
- Em cada dia útil, coletar e selecionar somente CNPJs da faixa programada naquele dia.
- Impedir mistura com leads de outras datas, mesmo que já estejam disponíveis no estoque local.
- Manter deduplicação de CNPJ e telefone, bloqueios, validação de WhatsApp e limite de 50 contatos por dia.
- Nomear cada campanha como `Certificado Digital — D+N — data`, mantendo Pausar, Retomar, Cancelar e detalhes.
- Exibir na aba Certificado Digital a etapa atual e um comparativo por faixa com enviados, entregues, lidos, respostas e taxa de resposta.
- Após D+30, encerrar a sequência automaticamente e preservar os resultados para comparação.

## Regras técnicas
- O agendamento existente de segunda a sexta às 09h BRT será reutilizado; nenhum novo agendamento será criado.
- A campanha somente será criada quando houver contatos validados da faixa do dia.
- Se uma faixa não tiver 50 contatos válidos, será usada apenas a quantidade disponível, sem completar com outra faixa.
- O processamento manual seguirá a faixa programada do dia para não contaminar o experimento.

## Validação
- Confirmar que amanhã seleciona exclusivamente CNPJs abertos há 5 dias.
- Confirmar nome, quantidade e controles da campanha no painel.
- Conferir o comparativo e garantir que nenhuma faixa recebeu contatos de outra data.
