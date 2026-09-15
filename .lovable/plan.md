# Captação diária de 500 contatos com WhatsApp no Google Maps

## Objetivo

Manter uma meta operacional de **500 novos contatos de empresas com WhatsApp confirmado por dia**, disponíveis para o aquecimento das BMs.

A meta será medida por contatos inéditos e confirmados no WhatsApp — não apenas por empresas retornadas pelo Google. Como o Google pode devolver duplicidades, empresas sem telefone ou números sem WhatsApp, o sistema buscará progressivamente até alcançar 500 ou atingir o limite diário de segurança.

## Situação confirmada

- O abastecimento automático atual para quando encontra 600 contatos disponíveis e permite no máximo **150 consultas Places por dia**.
- Cada consulta retorna até 20 empresas; cada busca salva no máximo 60 empresas e pode consumir até 18 consultas.
- Nos dias 14 e 15/09, foram confirmados **466 novos contatos com WhatsApp em 193 consultas**, média aproximada de **2,41 contatos confirmados por consulta**.
- Nesse rendimento, 500 contatos exigem aproximadamente **208 consultas por dia**. A quantidade real oscila conforme cidade, nicho, duplicidades e disponibilidade de WhatsApp.
- A verificação atual suporta até 600 telefones por execução, em lotes, usando as instâncias UAZAPI conectadas.
- As contas principal e reserva já alternam automaticamente quando a conta ativa chega a 4.800 consultas mensais.

## Alerta de custo alto

Esta mudança pode aumentar o consumo do Google Maps e as execuções do backend:

- **Uso esperado:** cerca de 208 consultas/dia para alcançar 500 contatos, com base no rendimento recente.
- **Custo estimado esperado:** aproximadamente **US$ 6,66/dia** ou **US$ 200 em 30 dias**, antes de créditos do Google.
- **Teto de segurança proposto:** 300 consultas/dia, equivalente a até **US$ 9,60/dia** ou **US$ 288 em 30 dias**.
- **Capacidade mensal:** as duas contas oferecem 9.600 consultas dentro da trava de 4.800 por conta. O teto máximo diário consumiria 9.000 em 30 dias, deixando pouca margem para buscas manuais.

A aprovação deste plano confirma esse novo teto de custo. Não será criado outro agendamento: o abastecimento continuará aproveitando o processo que já roda com o aquecimento.

## Implementação

1. **Trocar estoque fixo por meta diária**
   - Contabilizar separadamente, por dia: empresas novas, telefones encontrados, telefones verificados e contatos com WhatsApp confirmado.
   - Continuar captando enquanto houver menos de 500 contatos inéditos confirmados no dia.
   - Encerrar imediatamente ao atingir 500, mesmo que ainda exista saldo de consultas.

2. **Busca adaptativa com teto de 300 consultas**
   - Elevar o limite automático de 150 para no máximo 300 consultas por dia, compartilhado pelas contas principal e reserva.
   - Começar em lotes controlados e recalcular após cada verificação quantas consultas ainda são necessárias pelo rendimento do próprio dia.
   - Aumentar ou reduzir o próximo lote conforme a taxa de empresas com telefone, WhatsApp confirmado e duplicidades.
   - Manter trava contra execuções simultâneas e persistir o consumo após cada página consultada.

3. **Ampliar nichos e cidades sem repetir empresas**
   - Alternar entre nichos e cidades com melhor taxa de WhatsApp e resposta.
   - Retirar temporariamente combinações saturadas, com muitas duplicidades ou pouco telefone.
   - Manter deduplicação por `place_id`, telefone normalizado e sufixo de oito dígitos antes da verificação e do envio.
   - Nunca reutilizar como “novo do dia” um contato já existente na base.

4. **Confirmar WhatsApp no mesmo fluxo**
   - Verificar cada lote logo após a busca e atualizar o progresso diário somente com confirmações concluídas.
   - Distribuir a verificação entre instâncias UAZAPI conectadas, com troca automática se uma delas falhar.
   - Reprocessar pendências de forma limitada, sem impedir a verificação dos contatos recém-captados.
   - Se não houver instância verificadora conectada, pausar novas consultas para não gastar Google sem transformar resultados em contatos utilizáveis.

5. **Gerenciar as duas contas Google**
   - Preservar a principal até 4.800 consultas e alternar automaticamente para a reserva.
   - Manter contagem mensal individual e teto diário global.
   - Parar com segurança se as duas contas atingirem o limite, sem afetar os contatos já captados.
   - Reservar margem para buscas manuais; quando a projeção mensal ameaçar a capacidade restante, reduzir o automático e avisar no relatório.

6. **Relatório e alertas no WhatsApp**
   - Informar diariamente: meta 500, confirmados, empresas encontradas, sem WhatsApp, duplicidades, pendentes, consultas usadas e custo estimado.
   - Mostrar conta ativa, consumo de cada conta e projeção até o fim do mês.
   - Explicar claramente quando a meta não for alcançada: limite diário/mensal, falta de UAZAPI conectada, baixa oferta, saturação de nichos ou erro da chave.
   - Alertar ao atingir 400 contatos, 500 contatos, 80% do teto diário e na troca para a conta reserva.

## Regras de segurança

- Os 500 são uma **meta operacional**, não uma garantia de resultado do Google.
- Nenhum contato entra no aquecimento antes de ter WhatsApp confirmado.
- Permanecem o bloqueio aos domingos para envios, a carência de 15 dias, a blacklist e os bloqueios reais da Meta.
- A captação pode continuar preparando estoque, mas o envio sempre respeita horário, orçamento Meta, tier e saúde de cada número.
- As chaves nunca aparecem em relatórios, registros ou mensagens de erro.

## Validação

- Simular dias com rendimento alto, baixo e muitas duplicidades, comprovando a parada em 500 ou 300 consultas.
- Confirmar que o contador diário não duplica contatos e reinicia corretamente no fuso de Brasília.
- Testar troca principal → reserva e interrupção quando ambas atingirem 4.800.
- Testar indisponibilidade das instâncias UAZAPI e confirmar que novas consultas são pausadas.
- Executar um ciclo real controlado e conferir captação, confirmação, custo, disponibilidade para aquecimento e relatório final.
