Encontrei sinais fortes de consumo automático no backend, não de IA.

Pelo print, o saldo que caiu foi o saldo de Cloud: `Top-ups used $9.66`. A parte de AI está praticamente zerada (`$0` de top-up usado). Então o problema não parece ser Gemini/IA, e sim execução de backend, automações, funções e armazenamento.

O que encontrei agora:

- Tráfego do site está baixo: 6 visitantes e 13 pageviews ontem. Não parece ser pico de usuários.
- Existem muitos jobs automáticos ativos no backend.
- Nas últimas 24h, os maiores agendamentos rodaram mesmo sem trabalho útil:
  - `process-whatsapp-queue-10min`: 70 execuções.
  - `process-acionamento-agendado-v2`: 70 execuções.
  - `ai-budget-monitor-30min`: 34 execuções recentes, e o código dessa função nem existe no repositório atual, ou seja, está chamando endpoint inútil.
  - `aquecimento-auto-diario`: 30 execuções.
  - `aquecimento-autosave-horario`: 15 execuções.
- O aquecimento tem 166 registros, mas 0 ativos. Mesmo assim ainda existem jobs de aquecimento rodando automaticamente.
- A tela de configuração do WhatsApp também está cara: ao abrir `/admin/acionamento`, ela testa conexão de todas as instâncias ativas. Hoje há 103 instâncias ativas, e os logs mostraram 360 chamadas recentes para `test-uazapi-connection`.
- Armazenamento atual: `inbox-media` tem 4.916 arquivos, cerca de 404 MB. Não é o principal vilão sozinho, mas contribui.

Plano para cortar agora, em modo emergência:

1. Pausar imediatamente jobs automáticos não essenciais
   - Desativar os agendamentos que disparam funções externas sem necessidade imediata:
     - `ai-budget-monitor-30min`
     - `aquecimento-auto-diario`
     - `aquecimento-autosave-horario`
     - `aquecimento-promocao-fase-diaria`
     - `daily-report-aquecimento-20h`
     - `daily-whatsapp-report`
     - `process-whatsapp-queue-10min`
     - `process-acionamento-agendado-v2`
   - Efeito: corta o consumo automático recorrente. Envios manuais continuam funcionando, mas filas/agendamentos/relatórios/aquecimento automáticos ficam pausados até reativarmos.

2. Remover o job quebrado/inútil
   - Remover definitivamente o agendamento `ai-budget-monitor-30min`, porque ele chama uma função que não existe no código atual.

3. Corrigir a tela de WhatsApp para não gastar ao abrir
   - Alterar `/admin/acionamento` para não testar automaticamente as 100+ instâncias ao carregar a tela.
   - Manter o status em cache e colocar a verificação atrás de ação manual, como botão `Verificar conexões` ou teste individual por instância.
   - Isso evita centenas de chamadas `test-uazapi-connection` sempre que a tela abre ou re-renderiza.

4. Preservar funções manuais importantes
   - Não remover funções de envio manual, QR Code, inbox ou configuração de proxy.
   - Não apagar mensagens do banco.
   - Não mexer em permissões nem em dados de clientes/acordos.

5. Verificar depois do corte
   - Conferir a lista de agendamentos ativos.
   - Confirmar que não há mais execução automática frequente.
   - Conferir logs recentes para garantir que as chamadas automáticas pararam.

Impacto esperado:

- Corte imediato das execuções automáticas mais suspeitas.
- Redução grande de chamadas à UAZAPI ao abrir a configuração do WhatsApp.
- Automação de aquecimento, relatórios e filas/agendamentos ficam pausados temporariamente.
- Você ainda poderá enviar manualmente e usar as telas principais.

Se aprovar, eu aplico agora o modo emergência para parar o gasto recorrente.