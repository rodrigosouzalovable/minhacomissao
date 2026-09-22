# Corrigir a campanha do Certificado Digital

## Diagnóstico confirmado

- A campanha **Certificado Digital — 22/09/2026** existe e está rodando com 50 contatos.
- No momento da verificação, **6 mensagens já haviam sido enviadas** e 44 permaneciam na fila; mensagens já entregues não podem ser alteradas.
- O nome e o CNPJ foram enviados corretamente.
- O template possui quatro campos, nesta ordem: nome, CNPJ, data de abertura e valor.
- Os itens da campanha receberam somente nome e CNPJ. A data de abertura existente no cadastro do lead não foi encaminhada, e o valor não foi definido; por isso o preenchimento genérico produziu `R$ 0,00` nos dois últimos campos.
- A campanha está vinculada ao mesmo administrador, mas a tela do Certificado apenas atualiza uma chave que não controla o painel flutuante. Assim, a campanha criada fora do fluxo comum pode não ser carregada imediatamente no painel.

## Execução

1. **Pausar imediatamente a campanha atual**
   - Pausar pelo mesmo controle usado pelas campanhas normais.
   - Preservar os contatos ainda não enviados, sem duplicar os 6 já processados.

2. **Corrigir os dados do template**
   - Campo 1: nome da empresa já identificado.
   - Campo 2: CNPJ com 14 dígitos.
   - Campo 3: data real de abertura do CNPJ, formatada como `dd/mm/aaaa`.
   - Campo 4: valor fixo `R$ 129,90`.
   - Gravar esses quatro valores diretamente em cada item para não depender das regras genéricas usadas por campanhas de cobrança.

3. **Corrigir a fila atual**
   - Atualizar somente os contatos pendentes da campanha atual com a data correspondente de cada empresa e o valor correto.
   - Conferir uma prévia antes de retomar.
   - Retomar os 44 contatos restantes após a validação.

4. **Exibir como campanha normal**
   - Após criar uma campanha pelo Certificado Digital, carregá-la explicitamente no painel flutuante.
   - Manter os mesmos botões de **Pausar**, **Retomar**, **Parar/Cancelar** e **Ver detalhes** das demais campanhas.
   - Preservar o acompanhamento dos envios na caixa CERTIFICADO.

5. **Validar**
   - Confirmar a campanha no painel flutuante.
   - Confirmar que uma mensagem pendente renderiza nome, CNPJ, data e `R$ 129,90` corretamente.
   - Confirmar retomada com intervalo de 30 a 90 segundos e sem nova consulta à Casa dos Dados.
