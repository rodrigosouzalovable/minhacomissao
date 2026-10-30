# Credor automático pelo CPF no lançamento de acordo

## O que muda para o usuário
Ao digitar o CPF completo em **Novo Acordo** (tela do funcionário e do admin), o sistema consulta a base que chega do SFTP e já marca o credor:
- CPF só na carteira UME → marca **UME**.
- CPF só na carteira Odres Cred → marca **ODRES CRED**.
- CPF na base Novo Mundo (devedores importados) → marca **NOVO MUNDO**.
- Aparece um aviso verde abaixo do campo: "Credor identificado pela base SFTP: UME".
- CPF em mais de um credor → não marca sozinho; mostra aviso amarelo listando os credores para o usuário escolher.
- CPF não encontrado → nada é marcado, aviso discreto "CPF não encontrado na base; selecione o credor".
- O usuário continua podendo trocar o credor manualmente. Se ele já tiver escolhido um credor antes, o sistema não sobrescreve, só avisa se divergir.

Nenhuma regra de comissão, duplicidade de CPF ou salvamento muda.

## Detalhes técnicos
- Nova função no banco `identificar_credor_por_cpf(p_cpf)` (somente leitura, segura), retornando lista de credores encontrados: consulta `ume_carteira_parcelas` (mapeando o código da carteira para UME ou Odres, igual ao mapeamento já usado no fallback do Inbox) e `devedores` ativos do Novo Mundo, pelo CPF normalizado. Usa índices existentes por CPF; uma chamada por CPF digitado, sem polling (custo desprezível).
- `src/lib/credorPorCpf.ts`: chama a função e decide (único → auto; vários → ambíguo; nenhum → vazio) + teste dessa decisão.
- `NovoAcordo.tsx` e `NovoAcordoAdmin.tsx`: chamar junto da verificação de duplicidade já existente quando o CPF fica completo; preencher o credor só se ainda estiver vazio.
