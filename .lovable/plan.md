# Corrigir envios YELLOW/RED do Thiago Nogueira

## Diagnóstico confirmado

- Thiago está com a permissão Parceiro Meta ativa e possui 19 instâncias vinculadas atualmente.
- O número da imagem, **AMARAL 62 8277-3441**, foi consultado pelo sistema às **09h02 de 10/10/2026**: conectado, qualidade YELLOW, sem informação de banimento e com WABA/BUSINESS disponíveis para mensagens.
- A Meta informa que clientes bloquearam esse telefone e que, sem melhora de qualidade, sua cota não poderá aumentar. Isso é um aviso de reputação/cota; o retorno consultado não apresenta bloqueio total de mensagens.
- O interpretador reconhece apenas outra redação desse aviso. Por isso, transforma esse `LIMITED` em “Restrição de mensagens confirmada”, impedindo o início antes de aplicar a exceção do Thiago. O mesmo interpretador também é utilizado pelo seletor e pelo envio final.
- Há avisos equivalentes em outros números dele, inclusive avisos de nome pendente e qualidade concatenados. Atualmente são cinco YELLOW e um RED entre os vinculados.

## Correção proposta

1. **Interpretar corretamente os avisos da Meta**
   - Reconhecer as redações verificadas de limitação de cota por qualidade, isoladas ou combinadas com o aviso informativo de nome pendente.
   - Tratar como informativo somente quando todas as informações forem reconhecidas, a consulta estiver completa e as entidades comerciais estiverem disponíveis.
   - Não considerar erros de chamadas SIP como bloqueios de mensagens.
   - Manter bloqueios reais, banimentos, pendências comerciais, restrições desconhecidas e consultas inconclusivas como impedimentos.

2. **Preservar a liberação específica do Thiago**
   - Permitir que seus números vinculados YELLOW/RED passem pelo início, rodízio e envio final sem serem recusados apenas por esses avisos ou pelas travas internas abrangidas pela exceção existente.
   - Conferir usuário autenticado, permissão Parceiro Meta e vínculo de cada instância; a correção não dará acesso a números de terceiros.
   - Não ampliar as permissões de outros usuários nem alterar suas regras de seleção por qualidade. A interpretação correta do aviso será compartilhada para evitar divergências entre etapas.

3. **Atualizar os motivos exibidos**
   - Revalidar as instâncias afetadas do Thiago após disponibilizar a correção.
   - Substituir o falso motivo de bloqueio total por um aviso de qualidade/cota, preservando quaisquer impedimentos reais restantes.
   - Não indicar que a qualidade voltou a GREEN, nem prometer entrega ou recuperação.

4. **Validar sem disparar mensagens aos clientes**
   - Adicionar testes com os avisos exatos encontrados, incluindo a combinação de nome e qualidade.
   - Testar separadamente bloqueio real, pagamento, informação desconhecida e consulta incompleta, garantindo que continuem recusados.
   - Verificar a exceção com números vinculados e não vinculados, além de um usuário diferente de Thiago.
   - Conferir a seleção na tela e o fluxo de elegibilidade sem criar uma campanha real de teste. Depois, Thiago poderá iniciar seus próprios disparos; recusas reais da Meta continuarão registradas com o motivo original.

## Detalhes técnicos

- Ajuste principal em `supabase/functions/_shared/meta-messaging-health.ts`, com testes em `tests/metaMessagingHealth.test.ts`.
- Revisão dos consumidores: `check-meta-instance-health`, `envio-meta-massa-iniciar`, seletor compartilhado, tick e envio compartilhado. Ajustes adicionais somente onde necessários para manter a exceção autenticada e vinculada.
- Publicar as funções afetadas e executar uma revalidação pontual dos números do Thiago; nenhuma alteração global para forçar números restritos ao pool.
- Sem novos agendamentos, consultas periódicas, aumento de volume ou alteração do teto autorizado. A checagem pontual reutiliza a rotina existente.

**Limite:** enviar por YELLOW/RED continua sujeito às cotas e decisões da Meta e pode piorar a reputação dos números; a correção remove a interpretação incorreta, não contorna bloqueios externos.