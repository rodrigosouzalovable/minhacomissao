# Botão flutuante "Campanhas" não aparece para o Thiago Nogueira

## Diagnóstico (confirmado)

A permissão está correta: no banco, o login do Thiago Nogueira está com "Ver painel de Campanhas" ativo (e também modo parceiro). O código do botão já considera essa permissão.

O que esconde o botão é outra regra: hoje ele só aparece quando existe pelo menos uma campanha (ativa ou finalizada) do usuário. O Thiago ainda não tem nenhuma campanha registrada (zero disparos no histórico dele), então o botão nunca é exibido.

## O que muda

- O botão flutuante passa a aparecer sempre para quem tem permissão (admin, parceiro ou o toggle "Ver painel de Campanhas"), mesmo sem nenhuma campanha.
- Sem campanhas, o painel abre com um estado vazio: "Nenhuma campanha ainda — inicie um disparo na aba Envio Meta".
- O isolamento continua igual: cada usuário vê apenas as campanhas iniciadas pelo próprio login (a consulta e o Realtime já filtram por usuário).

## Detalhes técnicos

- `src/components/meta/CampanhasFlutuante.tsx`: remover o `return null` quando `jobsAtivos.length === 0 && finalizadasRecentes.length === 0`; manter apenas as guardas de loading e de permissão. Adicionar bloco de estado vazio no `PopoverContent` quando não houver campanhas.
- Nenhuma mudança de banco ou de RLS.
