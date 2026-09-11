# Corrigir os 1.000 Templates HSM e sincronizar diariamente

A base possui **1.106 templates em 68 instâncias**, mas a tela carrega somente a primeira página de 1.000 registros. Por isso o contador ficou travado em 1.000; os demais 106 registros existem, porém não aparecem.

## O que será corrigido

1. **Mostrar todos os Templates HSM**
   - Paginar a leitura em lotes de 1.000 até chegar ao fim.
   - Atualizar o contador, a cobertura por instância e a lista usando os 1.106 registros reais.
   - Buscar somente os campos necessários para reduzir o volume transferido.

2. **Sincronizar todos os templates vindos da Meta**
   - Corrigir a consulta à Meta para percorrer todas as páginas; hoje cada instância lê somente a primeira página de até 200 modelos.
   - Preservar os mapeamentos e dados já cadastrados ao atualizar status, categoria, texto, variáveis e componentes.
   - Tratar cada instância separadamente: uma conta com erro não interrompe as demais.

3. **Rotina de segunda a sexta às 06h BRT**
   - Substituir o agendamento atual das 07h pelo horário solicitado, **06h BRT (09h UTC), somente de segunda a sexta**.
   - A rotina primeiro atualizará os templates reais das instâncias Meta ativas e depois auditará quais modelos aprovados estão faltando.
   - Usará lotes limitados, trava contra duas execuções simultâneas e registro de progresso, continuando em chamadas controladas quando ainda houver instâncias pendentes.
   - Não incluirá parceiros, números inativos ou provedores que não sejam API Oficial Meta na auditoria automática, mantendo as regras atuais.

4. **Acompanhamento e falhas**
   - Registrar quantas instâncias foram verificadas, quantos templates foram atualizados e quais instâncias falharam.
   - Exibir o total real na tela e manter a sincronização manual já existente.
   - Validar a rotina publicada com uma execução controlada e conferir no banco que o total deixou de parar em 1.000.

## Aviso de custo da Lovable Cloud

Esta mudança fará uma sincronização automática por dia útil nas **69 instâncias Meta ativas**. O impacto esperado é **baixo a moderado**: cerca de 69 consultas iniciais à Meta por dia útil, com consultas extras apenas quando uma conta tiver mais de 200 templates. O processamento será feito em lotes para evitar picos e não haverá polling novo no navegador nem um segundo agendamento diário; o agendamento atual será substituído.

## Detalhes técnicos

- `ConfigurarMeta.tsx`: leitura paginada de `meta_whatsapp_templates`, sem o teto implícito de 1.000 linhas.
- `meta-sync-templates`: seguir `paging.next` da Graph API, validar entrada, limitar páginas e retornar totais/erros claramente.
- Criar um controlador diário reutilizando `meta-sync-templates` em lotes e, ao concluir, chamar a auditoria existente.
- Alterar o job `meta-templates-sincronizar-diario` de `0 10 * * 1-6` para `0 9 * * 1-5`, sem criar agendamento concorrente.
- Preservar a verificação de aprovação a cada 30 minutos e a injeção gradual a cada 2 minutos; elas têm finalidades diferentes.
