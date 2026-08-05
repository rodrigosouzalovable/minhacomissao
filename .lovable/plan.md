# Diagnóstico: instabilidade, "atualiza sozinho" e travamentos

Fiz uma avaliação do sistema (código do site + saúde e consultas reais do banco). Os relatos dos funcionários têm causas concretas e identificadas.

## O que está acontecendo

**1. O site recarrega os dados sozinho a cada troca de aba/janela**

O cliente de dados do app foi criado sem nenhuma configuração (`new QueryClient()` em `src/App.tsx`, linha 71). Nesse padrão, toda vez que o funcionário volta para a aba do navegador (ou clica de novo na janela), **todas** as consultas da tela são refeitas do zero. É exatamente a sensação de "fica atualizando sozinho".

**2. A tela "Acordos" lê a tabela inteira de parcelas a cada carregamento**

Em `src/pages/Acordos.tsx` (linha ~820) existe um laço que pagina a tabela `pagamentos` **sem nenhum filtro**, de 1000 em 1000 linhas, até o fim da tabela — só para calcular "quebra de acordo" e datas de vencimento. Isso aparece no banco como uma das consultas mais custosas do projeto: **300.961 execuções, média de 496 ms, pico de 8 segundos**. O mesmo padrão existe em "Acordos da equipe" (`EquipeAcordos.tsx`, leitura paginada de todos os pagamentos pagos + até 10.000 pendentes).

Quando várias pessoas abrem essa tela ao mesmo tempo (e o item 1 refaz tudo a cada foco), o banco fica ocupado e a tela congela.

**3. O painel de envio Meta fica lendo listas gigantes em segundo plano, em todas as páginas**

`EnvioMetaSendingContext` é um provedor global (carrega em qualquer tela) que, com Realtime ligado, relê até 10.000 linhas de `envio_meta_job_item` e o log de envios. No banco: **651.244 execuções, média 596 ms** numa consulta e **1.119.276 execuções, média 250 ms** na outra. Os índices necessários já existem — o problema é a **quantidade e o tamanho** das leituras, não a falta de índice.

**4. Muitos temporizadores e canais em tempo real simultâneos**

Há 12 canais Realtime e dezenas de `setInterval` (Inbox 60 s, contadores de 1 s, monitores 60 s, etc.). Vários já têm proteção de "só quando a aba está visível", outros não. Somados, geram travadas de interface.

**5. Sinal de erro em massa no banco**

A saúde do banco está estável (memória 32%, disco 23%, conexões 71/160), mas há **4.138.854 transações revertidas** desde o último boot — indício de um volume alto de consultas falhando/negadas repetidamente, que precisa ser rastreado.

## Correções propostas

**Etapa 1 — parar o "atualiza sozinho" (efeito imediato, risco baixo)**
- Configurar o cliente de dados global com `refetchOnWindowFocus: false`, `staleTime` padrão de 60 s, `retry: 1` e sem refetch em segundo plano.
- Manter os poucos casos que realmente precisam de atualização ao vivo (envio em andamento, inbox) com refetch explícito.

**Etapa 2 — eliminar a varredura da tabela de parcelas (maior ganho de performance)**
- Criar uma função no banco (`SECURITY DEFINER`, respeitando as permissões atuais) que devolva, por acordo, apenas o que a tela precisa: última parcela pendente, última paga e datas de vencimento — filtrada pelos acordos já carregados na tela.
- Substituir o laço de paginação em `Acordos.tsx` e o bloco equivalente em `EquipeAcordos.tsx` por uma única chamada a essa função, restrita aos acordos visíveis/filtrados.
- Adicionar índice de apoio se o plano de execução indicar necessidade após a mudança.

**Etapa 3 — conter o provedor global de envio Meta**
- Só ativar Realtime e as leituras pesadas quando existir um envio em andamento e o usuário estiver na aba/janela ativa.
- Limitar `carregarItens` a um teto muito menor (últimos itens processados) em vez de até 10.000 linhas, e agregar contagens por consulta de contagem em vez de baixar as linhas.

**Etapa 4 — higienizar temporizadores e Realtime**
- Padronizar todos os `setInterval` com verificação de aba visível e limpeza no desmonte.
- Consolidar canais Realtime duplicados (badges de não lidos do inbox) em uma única inscrição.

**Etapa 5 — investigar as transações revertidas**
- Levantar quais chamadas estão falhando em massa (logs de API/funções + políticas de acesso) e corrigir a origem, para reduzir carga inútil no banco.

## Detalhes técnicos

- Arquivos principais: `src/App.tsx` (QueryClient), `src/pages/Acordos.tsx`, `src/pages/EquipeAcordos.tsx`, `src/contexts/EnvioMetaSendingContext.tsx`, `src/components/layout/AppLayout.tsx`.
- Banco: nova função de agregação de parcelas por acordo, com `GRANT EXECUTE` para usuários autenticados; nenhum dado é alterado ou apagado.
- Nenhuma nova rotina agendada, nenhum novo canal Realtime e nenhum novo polling serão criados — o plano **reduz** consumo do Lovable Cloud em vez de aumentar.
- Sem alteração de regras de negócio: os mesmos critérios de quebra de acordo (10 dias) e os mesmos filtros de vencimento continuam valendo.

## Ordem sugerida

Etapa 1 e 2 juntas já devem resolver a maior parte do que os funcionários relatam. Etapas 3 a 5 são o acabamento para o sistema ficar estável sob uso simultâneo.
