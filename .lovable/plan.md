# Ignorar destinatários com telefone incompleto no Envio Meta

## Diagnóstico confirmado
- O aviso **“Confira o DDI de 2 número(s): 32919332”** vem de uma validação em `EnvioMeta.tsx` que interrompe todo o disparo quando encontra um telefone incompleto ou com DDI não identificado.
- A função que inicia a campanha também rejeita a lista caso receba um telefone inválido. Portanto, os números ignorados não devem ser enviados para a criação da campanha.

## Alteração
1. **Separar automaticamente os destinatários válidos dos inválidos** antes das demais validações de envio. Números como `32919332`, sem DDD/DDI identificável, serão ignorados, sem inventar prefixos.
2. **Prosseguir com os demais destinatários**, mantendo a confirmação normal do disparo ou agendamento. Substituir o aviso bloqueante por uma informação com a quantidade de números ignorados.
3. **Usar somente a lista válida** na contagem de contatos, estimativa de custo, conferência de reenvios recentes, confirmação e criação da campanha. Preservar nome, CPF e demais dados de cada linha válida, inclusive a primeira linha de planilhas sem cabeçalho.
4. Se todos os números forem inválidos, não iniciar campanha vazia e informar que não restaram destinatários com telefone válido.
5. **Não colocar esses números na blacklist**: telefone incompleto não comprova ausência de WhatsApp. Preservar as regras existentes de descadastro, números confirmados sem WhatsApp, duplicidades e reenvio recente.

## Detalhes técnicos e limites
- Reutilizar a normalização compartilhada de destinatários e centralizar a separação da lista na interface, enviando à função existente somente os válidos; manter sua proteção contra entradas inválidas.
- Preservar telefones brasileiros com DDD e internacionais com DDI explícito. A restrição nacional das instâncias remetentes não será aplicada aos destinatários.
- Não modificar campanhas em execução, regras de qualidade, intervalos ou pool. Sem novas consultas recorrentes ou agendamentos.

## Validação
- Lista mista com `32919332` e dois brasileiros válidos: ignorar o incompleto e preparar exatamente dois destinatários.
- Vários inválidos: conferir quantidade ignorada e continuidade dos válidos.
- Lista totalmente inválida: impedir campanha vazia com mensagem clara.
- Conferir brasileiros, internacionais com `+`/`00`, primeira linha sem cabeçalho e preservação dos dados das linhas válidas.
- Validar contagem, custo e lista enviada em teste, sem disparos reais nem inclusão de inválidos na blacklist.