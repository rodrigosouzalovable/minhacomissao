# Painel de descontos para qualquer credor de destino

Hoje o painel "Descontos do portal" só aparece quando o layout escolhido é "MMP Mundo da Moda". A tabela de faixas do banco já é por credor (chave = nome normalizado), então basta abrir o painel a partir do credor de destino.

## O que muda

- Ao escolher qualquer **Credor de Destino** (lista ou "Outro (digitar)"), o painel de descontos do portal abre logo abaixo, já com as faixas salvas daquele credor — ou com as faixas padrão do sistema como ponto de partida, quando ainda não houver nada salvo.
- O título do painel passa a exibir o nome do credor selecionado.
- Trocar o credor de destino recarrega as faixas do novo credor.
- Em "Outro (digitar)", o painel só aparece depois que o nome for digitado (evita painel sem credor).
- Nos layouts em que o credor é automático (Pagamentos, UME APORTE, UME Consolidado, Montreal Atualização), o painel aparece para o credor automático correspondente.
- Nada muda no portal público: ele continua aplicando as faixas salvas do credor com maior valor em aberto do CPF, com fallback nas regras padrão.

## Detalhes técnicos

- `src/pages/ImportarDevedores.tsx`: substituir a renderização condicional `isMmp && <DescontosCredorEditor credor={CREDOR_MMP} .../>` por um painel baseado num valor derivado `credorParaDescontos` (credor automático quando houver, senão `credorDestino`/`credorOutro`), renderizado quando esse valor não for vazio e diferente de `outro`; passar `credor` e `titulo` ao editor.
- `src/components/portal/DescontosCredorEditor.tsx`: já recarrega via `useEffect` dependente de `credorKey`; garantir que a troca de credor limpe o estado local antes do carregamento (nenhuma mudança de contrato do componente).
- Nenhuma migração de banco necessária.
