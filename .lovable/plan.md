# Corrigir o envio da instância SOUZA 62 8268-9965

## Diagnóstico confirmado

A instância está **conectada**, no **tier 250**, com o nome **Souza e Ribeiro** e status da Meta `AVAILABLE_WITHOUT_REVIEW`.

Esse status significa que o nome está disponível para uso sem precisar passar por nova análise. O sistema atualmente considera apenas `APPROVED` como liberado e, por isso, gravou incorretamente **“Nome de exibição ainda não aprovado pela Meta”**, colocou a instância como restrita e não criou a trilha de 25 envios do dia.

Há também um segundo impedimento independente: o único template UTILITY instalado nessa instância, `registramos_seu_interesse_no_acordo`, ainda está com status `PENDING`. Enquanto a Meta não aprová-lo, ele não pode ser usado no aquecimento.

## Correção

1. Considerar `AVAILABLE_WITHOUT_REVIEW` como nome válido e liberado em todas as verificações do sistema.
2. Não transformar a limitação informativa associada a esse status em bloqueio total do pool; manter o tier 250 e seu limite normal.
3. Corrigir os avisos dos cards e da caixa de entrada para não mostrarem “nome pendente” nesse estado.
4. Revalidar a instância e remover o motivo antigo, devolvendo-a ao pool ativo sem ignorar bloqueios reais da Meta.
5. Sincronizar o status do template. Se já estiver aprovado na Meta, iniciar imediatamente a trilha de aquecimento; se continuar `PENDING`, deixar a instância pronta para começar automaticamente assim que a aprovação chegar.
6. Validar que a meta diária da BM seja distribuída corretamente, sem ultrapassar **25 conversas únicas por dia** para o tier 250.

## Proteções mantidas

- `REJECTED` continua bloqueado.
- Bloqueios comerciais, de conta, pagamento, qualidade YELLOW/RED e recusas reais da Meta continuam sendo respeitados.
- Somente templates UTILITY aprovados serão enviados.
- Não será criado novo agendamento, consulta repetitiva ou processo contínuo; não haverá aumento relevante de custo.

## Detalhes técnicos

- Centralizar a interpretação dos estados válidos do nome para evitar diferenças entre verificação de saúde, seleção de instância, aquecimento e interface.
- Ajustar a leitura de `health_status` para distinguir uma limitação informativa de nome em `AVAILABLE_WITHOUT_REVIEW` de uma restrição real de envio.
- Reconciliar `estado_pool` e `pausa_automatica_motivo` após a nova verificação.
- Testar a seleção do número, a criação da trilha diária e o primeiro envio após existir template aprovado.
