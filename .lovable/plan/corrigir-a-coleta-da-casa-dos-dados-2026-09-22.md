# Corrigir a coleta da Casa dos Dados

## Diagnóstico confirmado

- A chave cadastrada está salva e foi utilizada na tentativa das 12:58 BRT.
- O sistema ainda chama a rota antiga `v2/public/cnpj/search`; os registros mostram resposta HTTP 503 do servidor da Casa dos Dados.
- A API oficial atual disponibiliza a pesquisa avançada em `v5/cnpj/pesquisa`, com um formato diferente para filtros, paginação e resposta.
- O cadastro atual aceita e salva a chave mesmo quando o teste recebe 503. Por isso a tela confirmou o cadastro sem comprovar que a chave e o acesso à pesquisa estavam funcionando.

## Alterações

1. **Atualizar a integração para a API v5**
   - Trocar a rota antiga pela pesquisa avançada oficial v5.
   - Converter UF, CNAE, data de abertura, situação ativa, MEI, celular, página e limite para o formato atual.
   - Adaptar a leitura da resposta v5 para importar CNPJ, empresa, telefones, e-mail, CNAE, endereço e data de abertura.

2. **Validar a chave corretamente**
   - Usar a consulta oficial de saldo para confirmar autenticação sem executar uma pesquisa ampla.
   - Exibir separadamente: chave inválida, sem saldo/acesso, limite excedido, indisponibilidade temporária e formato de consulta rejeitado.
   - Não marcar uma nova chave como validada quando o teste não obtiver confirmação real da Casa dos Dados.

3. **Manter o fluxo de processamento seguro**
   - Ao clicar em “Iniciar processamento e envios”, coletar primeiro pela v5, importar os leads, verificar quais números têm WhatsApp e só então criar a campanha.
   - Preservar o limite de 50 envios por dia, o intervalo de 30–90 segundos e a BM/template já selecionados.
   - Se uma janela falhar, registrar o motivo real sem classificar a falha como “nenhum contato elegível”.

4. **Compatibilidade e validação**
   - Testar autenticação da chave, uma coleta mínima e o mapeamento dos dados retornados.
   - Publicar as funções de cadastro, busca manual, coleta automática e início da prospecção.
   - Confirmar na tela que o clique cria a campanha quando existirem leads com WhatsApp e mostra uma orientação específica quando não houver saldo ou acesso à pesquisa.

## Resultado esperado

A chave cadastrada será realmente validada na API atual. O botão iniciará a coleta pela Casa dos Dados, verificará os números e criará a campanha de Certificado Digital sem depender da rota antiga que está retornando 503.
