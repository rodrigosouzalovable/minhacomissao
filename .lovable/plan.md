# CPF 912.370.092-00: acordo UME não lança

## O que foi encontrado
- O CPF **não está** na carteira UME nem na Odres dos arquivos SFTP de hoje (27/10). Os dois arquivos foram importados por completo: 24.702 clientes UME e 41.972 Odres.
- Por isso o botão do boleto/PIX nem chega a consultar a UME. Não existe nenhuma tentativa de simulação para esse CPF no histórico. O sistema para logo no início, com o aviso "CPF não está nos arquivos UME/Odres".
- O backoffice UME mostra "EXISTEM RENEGOCIAÇÕES EM ABERTO". O acordo 88715 aparece como Quebrado, mas a UME provavelmente ainda o trata como renegociação aberta. Nesse caso, ela tira o cliente do arquivo de cobrança, e a API também recusaria um novo acordo.
- A conversa existe (telefone 55 95 99144-3510, credor UME), mas sem nome e sem dívida na nossa base.

## O que fazer
1. **Com a UME (fora do sistema):** pedir que encerrem ou cancelem a renegociação 88715, que está quebrada. Assim o cliente volta para o arquivo do dia seguinte e o botão funciona normalmente.
2. **Mensagem mais clara no sistema:** quando o CPF não estiver no arquivo, a janela vai mostrar: "Este CPF não veio no arquivo UME/Odres de hoje. Normalmente isso acontece quando a UME ainda considera aberta uma renegociação antiga (mesmo quebrada). Peça à UME para encerrá-la ou lance o acordo pelo + da conversa." Também vai mostrar a data do último arquivo em que o CPF apareceu, se houver.
3. **Registrar a recusa:** guardar essas tentativas no histórico de acordos UME com o motivo "fora da carteira", para que casos assim apareçam logo, sem precisar investigar.

## Detalhes técnicos
- `ume-acordo-api`: na resposta `cpf_fora_da_carteira`, incluir a nova mensagem e gravar o log (`acao='carregar'`, `sucesso=false`, `resposta.motivo`).
- `AcordoUmeApiDialog.tsx`: mostrar essa mensagem em destaque, com um atalho para abrir o "+" da conversa.
- Sem custo extra: nada de novas rotinas ou consultas periódicas.
