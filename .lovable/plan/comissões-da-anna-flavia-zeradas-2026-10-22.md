# Comissões da Anna Flavia zeradas

## Causa confirmada
- Anna Flavia tem 741 acordos e 4.502 parcelas (1.198 pagas, R$ 281.950,69).
- A tela Usuários > Comissões busca as parcelas enviando os 741 códigos de acordo de uma só vez. A consulta fica grande demais e falha, então a tela mostra R$ 0,00.
- Mesmo quando passa, a busca traz no máximo 1.000 parcelas, o que cortaria valores de operadores com muitos acordos.

## Correção
- Buscar acordos e parcelas em blocos (ex.: 150 acordos por vez) e páginas de 1.000 parcelas, juntando tudo antes de calcular.
- Aplicar o mesmo carregamento em blocos aos acordos do operador (também limitados a 1.000).
- Mostrar aviso de erro na tela se alguma busca falhar, em vez de exibir zero.
- Nenhuma regra de comissão, valor ou permissão muda; sem custo recorrente novo.

## Validação
- Abrir a comissão da Anna Flavia e conferir Total Parcelas Pagas = R$ 281.950,69 sem filtro de período, e a divisão Novo Mundo/UME/Odres somando o total.
- Conferir um operador pequeno para garantir que nada mudou.

## Detalhes técnicos
- Arquivo: `src/pages/UsuarioComissoes.tsx` (queries `user-acordos` e `user-pagamentos`), helper paginado com `.range()` e fatiamento de `acordo_id`.
