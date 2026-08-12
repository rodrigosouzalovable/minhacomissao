# Painel de descontos independente da importação

## Situação atual (verificado)

- Em `ImportarDevedores.tsx` o painel de descontos hoje é renderizado **dentro do card "Upload de Planilha"**, condicionado ao credor derivado do seletor de importação. Na sua tela ele não apareceu — não consegui reproduzir no navegador (a sessão de teste expirou e caiu no login), então a causa exata segue não confirmada: pode ser tela em cache/versão antiga ou o painel ficando escondido pelo acoplamento ao fluxo de importação.
- O portal público já busca as faixas **em tempo real** a cada consulta de CPF (via a função `portal_faixas_credor`, pelo credor com maior valor em aberto). Não há cache: qualquer alteração salva já vale na próxima consulta.

## O que será feito

### 1. Card próprio "Descontos do portal por credor"

- Um card independente na página **Importar Devedores**, sempre visível, acima do histórico de importações — não depende de escolher layout de planilha nem de importar arquivo.
- Dentro dele: seletor **Credor** com a lista de credores já existentes no sistema + opção "Outro (digitar)".
- Ao escolher o credor, as faixas salvas dele carregam na hora (ou as faixas padrão do sistema como ponto de partida, quando ainda não houver nada salvo).
- Mantém tudo que já existe no editor: De (dias), Até (dias), % à vista, % parcelado, adicionar faixa, remover faixa e salvar, com as validações atuais.

### 2. Painel também no fluxo de importação

- Ao selecionar um **Credor de Destino** no card de upload, o painel continua aparecendo ali mesmo, já apontado para aquele credor (comportamento que você pediu antes), agora reaproveitando o mesmo componente.
- Se o layout definir o credor automaticamente (Pagamentos, UME APORTE, UME Consolidado, Montreal Atualização), o painel abre para esse credor automático.

### 3. Reflexo imediato no portal

- Nada muda na lógica do portal: ele já lê as faixas salvas na hora da consulta. Qualquer edição futura passa a valer para o cliente na consulta seguinte, sem republicar nada.
- Sem faixas cadastradas para o credor, seguem valendo as regras padrão do sistema.

## Detalhes técnicos

- Extrair a escolha de credor para um wrapper `src/components/portal/DescontosCredorCard.tsx` (seletor de credor + `DescontosCredorEditor`), carregando a lista de credores por `listar_credores_distintos` com fallback nas opções fixas (`MMP MUNDO DA MODA`, `MUNDO DA MODA`, `UME | NOVO MUNDO`, `MONTREAL`).
- `ImportarDevedores.tsx`: renderizar o novo card sempre; manter a renderização condicional atual baseada em `credorParaDescontos` dentro do card de upload.
- `DescontosCredorEditor.tsx`: sem mudança de contrato; só garantir que a troca de `credor` limpe o estado antes de recarregar.
- Sem migração de banco: `credor_desconto_faixas` (leitura/escrita restrita a admin) e a RPC `portal_faixas_credor` já atendem.
