# Corrigir o início da prospecção do Certificado Digital

## Diagnóstico confirmado

- O botão chamou o processamento às 11:02 e novamente às 11:04 BRT.
- A coleta tentou todas as janelas configuradas, porém a API da Casa dos Dados respondeu **503 — serviço temporariamente indisponível** em todas elas.
- O coletor registrou essas falhas, mas não as devolveu ao processo principal. Por isso, o sistema continuou com zero leads e mostrou apenas **“Nenhum contato com WhatsApp está elegível”**, dando a impressão de que o botão não funcionou.
- Não foi criada campanha nem iniciado envio porque atualmente existem zero leads coletados e zero contatos com WhatsApp confirmado.

## Correção

1. **Tratar indisponibilidade da Casa dos Dados**
   - Repetir automaticamente chamadas que falharem por indisponibilidade temporária, limite ou erro de rede, com poucas tentativas e espera progressiva.
   - Não repetir erros definitivos de configuração ou autenticação.
   - Preservar o registro individual de cada janela consultada.

2. **Não esconder falhas de coleta**
   - Fazer o processamento consolidar o resultado das janelas.
   - Se todas falharem, interromper antes da verificação e dos disparos, retornando uma mensagem clara: a Casa dos Dados está temporariamente indisponível e nenhuma campanha foi criada.
   - Se apenas algumas falharem, continuar com os leads obtidos e informar o resultado parcial.

3. **Executar o fluxo completo pelo botão**
   - Ao clicar, coletar os leads nas janelas configuradas.
   - Verificar imediatamente quais telefones possuem WhatsApp usando somente as instâncias UAZAPI selecionadas.
   - Criar a campanha diária apenas com contatos confirmados, respeitando o limite de 50, deduplicação e bloqueios existentes.
   - Iniciar o primeiro envio e manter os próximos entre 30 e 90 segundos pela fila já existente.

4. **Melhorar o retorno na tela**
   - Manter o botão ocupado durante o processamento para impedir cliques duplicados.
   - Exibir resultados separados: leads coletados, WhatsApps confirmados e campanha iniciada.
   - Mostrar claramente falha externa, resultado parcial ou ausência real de contatos.
   - Atualizar a lista de leads, o contador diário e o painel flutuante de campanhas ao concluir.

## Validação

- Simular resposta 503 e confirmar novas tentativas, mensagem clara e ausência de campanha vazia.
- Testar sucesso completo: coleta, verificação, criação da campanha e primeiro envio.
- Testar sucesso parcial em algumas janelas.
- Confirmar que cliques repetidos não criam campanhas duplicadas.
- Conferir a campanha no painel, mensagens na caixa CERTIFICADO e intervalo de 30–90 segundos.
