# Relatório de campanhas: só as minhas, template e acordos que realmente contam

## O que muda

1. **Só as campanhas iniciadas pelo seu login**
   O relatório das 19h30 passa a listar apenas as campanhas criadas pelo seu usuário admin (RODRIGO RIBEIRO DE SOUZA). Campanhas do Thiago e de qualquer usuário com a marcação parceiro Meta deixam de aparecer. Hoje, das 11 campanhas do relatório, 10 eram de outro usuário — só "UME + NOVO MUNDO 10" era sua.

2. **Template de cada campanha no relatório**
   Cada linha passa a mostrar o modelo de mensagem usado, por exemplo `dados_cadastrais`, `colchao_vencido`, `validacao_nm`, além do nome da campanha.

3. **Acordos passam a ser contados de verdade**
   Hoje deu 0,0% porque a contagem cruzava CPF, e os envios recentes estão gravados sem CPF (todos os 7.472 itens dos últimos 2 dias têm o campo de CPF vazio). Passa a cruzar pelo telefone (últimos 8 dígitos), que é a mesma regra já usada no resto do sistema, e o CPF continua valendo quando existir.
   Testando a campanha "UME + NOVO MUNDO 10" com essa regra: **17 acordos, R$ 23.861,36** — hoje o relatório mostrou 0.

4. **Acompanhamento contínuo, conforme os atendentes lançam**
   O acordo é atribuído à campanha quando o cliente recebeu a mensagem e o acordo foi lançado depois, dentro de 15 dias — não importa qual atendente lançou. Como o número é recalculado a cada consulta e a cada relatório, uma campanha de hoje continua ganhando acordos nos próximos dias, e o valor em reais e a porcentagem sobem junto.

5. **Comparativo por modelo de mensagem**
   No fim do relatório entra um resumo por template: quantas enviadas, taxa de resposta e acordos/valor de cada modelo nos últimos 30 dias, para você ver qual template converte melhor e direcionar as próximas campanhas.

6. **Também passar a gravar o CPF nos envios**
   Quando a planilha da campanha tiver CPF, ele volta a ser gravado em cada destinatário. Isso deixa a medição mais precisa no futuro (telefone trocado, número de familiar etc.), sem mudar nada no seu jeito de disparar.

## Detalhes técnicos

- `envio_meta_job_resultado_calcular(uuid)`: nova migração trocando o casamento de acordos — `right(digits(acordos.cliente_telefone),8) = right(digits(item.telefone),8)` OU CPF normalizado igual, com `acordos.criado_em` entre o envio e envio + 15 dias; `acordos_valor` = soma de `valor_total` dos acordos distintos.
- `supabase/functions/envio-meta-relatorio-diario/index.ts`: filtro `.eq("user_id", <admin>)` resolvido dinamicamente via `user_roles.role = 'admin'` (o dono do relatório), inclusão de `template_nome` por linha, e bloco novo agregando por template nos últimos 30 dias. A média de 7 dias passa a considerar só campanhas do mesmo dono.
- `src/components/meta/CampanhaResultadoCard.tsx`: mostra template e a observação de que o valor continua sendo atualizado nos 15 dias seguintes.
- `envio-meta-massa-iniciar`: persistir `cpf` em `envio_meta_job_item` quando a planilha trouxer a coluna.
- Índice de apoio em `acordos` para o sufixo do telefone, se o plano de execução mostrar consulta lenta.

## Fora do escopo

O card de resultado dentro de "Ver detalhes" continua admin-only e sem filtro por dono — ali você abre a campanha específica que escolheu.
