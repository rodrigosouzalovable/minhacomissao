# Dois casos: resposta da Simone e instancias do Tiago

## 1. Resposta para a Simone (Novo Mundo 3144) - sem defeito
- A resposta do Rodrigo (16/11 09:17) foi aceita pela Meta e esta marcada como ENTREGUE no celular da cliente. Ela recebeu.
- A foto e do celular da propria empresa. Mensagens enviadas pelo Inbox podem nao aparecer (ou demorar) nesse celular: o espelhamento e feito pela Meta, nao pelo sistema.
- As 3 mensagens "retidas" eram cliques nos botoes do template; a Meta enviou sem conteudo, nao ha como recuperar.
- Nenhuma alteracao necessaria.

## 2. Tiago nao ve as instancias no Envio Meta e na API Oficial Meta - defeito confirmado
O que acontece: o Tiago tem 29 numeros. Ao abrir a tela, o sistema busca ao mesmo tempo as instancias e TODOS os 8.832 templates da empresa. Para quem nao e admin, essa busca de templates passa por varias verificacoes de permissao linha a linha e estoura o tempo limite (registramos dezenas de falhas desse tipo na ultima hora). Como as buscas estao amarradas, a falha dos templates derruba tambem a lista de instancias, e a tela mostra "Nenhuma instancia".

Correcao:
1. Envio Meta: carregar as instancias primeiro e mostra-las mesmo se outra parte falhar.
2. Buscar so os templates das instancias do proprio usuario (29 numeros em vez de 8.832 templates), o que deixa a carga rapida.
3. Aplicar o mesmo na aba API Oficial Meta, que tambem mostrou "Instancias (0)".
4. Acelerar a regra de permissao dos templates (calcular a permissao do usuario uma vez por consulta, nao por linha), sem ampliar quem ve o que.

## Detalhes tecnicos
- `src/pages/EnvioMeta.tsx` `carregar()`: trocar Promise.all por chamadas independentes; templates via `carregarTodosMetaTemplates(cols, { instanciaIds })` apos as instancias (admins mantem a busca atual).
- Pagina da API Oficial Meta: mesmo padrao.
- Migracao: politica `meta_templates_parceiro_all` e `meta_templates_cliente_parceiro_select` com `(select auth.uid())` e funcoes envolvidas em subselect.
- Sem novo cron, polling ou custo extra; reduz carga do banco.
