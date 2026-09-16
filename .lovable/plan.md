# Esteira diária de Google Maps Leads para colaboradores

## Objetivo

Entregar diariamente a cada colaborador comum uma lista exclusiva de **10 empresas com WhatsApp confirmado e sem site**, reaproveitando somente os leads já existentes na base. Parceiros Meta continuam com as ferramentas de busca; somente o administrador vê a tela completa.

## Acesso por perfil

- **Administrador:** mantém a tela completa atual, incluindo configurações, consumo, chaves, nova busca, buscas recentes, análise, mapa e base geral.
- **Parceiro Meta:** vê somente **Nova Busca**, **Buscas Recentes** e os **Leads** da busca, sem configurações administrativas, chaves, consumo ou base completa.
- **Demais usuários autorizados:** veem apenas **Minha lista de prospecção**, sem busca, mapa, configurações ou informações administrativas.
- A aba continuará sendo liberada individualmente nas permissões do usuário. A proteção será aplicada também no banco, não apenas escondendo partes da tela.

## Lista diária do colaborador

1. Cada colaborador recebe até **10 leads novos por dia**, exclusivos para ele.
2. O botão **Trazer 10 novos leads** completa a cota do dia:
   - se ainda não recebeu nenhum, entrega 10;
   - se já recebeu parte, entrega apenas o restante até 10;
   - se já recebeu 10, informa que a cota diária foi concluída.
3. O primeiro acesso também carrega a lista já atribuída no dia. Se ainda estiver vazia, o sistema pode preencher a cota pelo mesmo processo seguro do botão, sem usar a API do Google.
4. Um mesmo lead nunca será atribuído simultaneamente a dois colaboradores.
5. Leads não contatados permanecem visíveis no histórico da pessoa; a cota do dia seguinte acrescenta novos leads sem apagar os anteriores.

## Seleção dos melhores possíveis clientes

Serão elegíveis apenas empresas que:

- tenham WhatsApp confirmado;
- não possuam site próprio; perfil de rede social isolado poderá ser tratado como “sem site próprio”;
- ainda não tenham sido atribuídas a outro colaborador;
- não estejam na blacklist nem tenham resultado final anterior de “sem interesse”;
- possam ter sido usadas no aquecimento — esse histórico não impede o reaproveitamento comercial.

A ordem priorizará maior probabilidade de venda com uma pontuação transparente:

1. maior nota e quantidade de avaliações no Google;
2. telefone/WhatsApp confirmado recentemente;
3. empresa com endereço e categoria completos;
4. diversidade de nichos, evitando entregar dez empresas praticamente iguais;
5. leads mais antigos como desempate, para aproveitar bem a base existente.

A base atual já possui **286 empresas com WhatsApp confirmado e sem site**; **224** atendem ao filtro inicial de nota mínima 4,0 e pelo menos 10 avaliações. Isso permite começar sem novas consultas ao Google, mas o estoque será acompanhado porque 10 leads por colaborador/dia pode consumi-lo rapidamente.

## Ações e acompanhamento

Cada item mostrará somente o necessário para trabalhar:

- empresa, nicho, cidade/endereço, telefone, nota e avaliações;
- botão para abrir ligação;
- botão para abrir o WhatsApp;
- checkbox **Já entrei em contato**;
- resultado: **Interessado**, **Sem interesse**, **Não respondeu** ou **Retorno agendado**;
- data do retorno quando o resultado for “Retorno agendado”.

A lista terá filtros simples por pendentes, contatados, interessados e retornos. O administrador poderá acompanhar quantidade entregue, contatada e resultados por colaborador, sem expor esse painel aos demais.

## Segurança e dados

- Criar uma estrutura própria de atribuições, vinculando lead, colaborador, dia, situação e resultado.
- Garantir exclusividade com regra no banco e distribuição atômica, evitando duplicação mesmo com cliques simultâneos.
- Permitir que colaboradores leiam e atualizem somente suas próprias atribuições.
- Permitir acesso total apenas ao administrador.
- Parceiros Meta não recebem atribuições nessa esteira.
- A listagem comum não dará acesso direto à base completa de `google_maps_leads`.
- Adicionar índices leves para seleção por elegibilidade, colaborador e data.

## Impacto de custo

- **Nenhuma nova consulta à API do Google Maps.**
- **Nenhum novo cron, polling ou atualização em tempo real.**
- A distribuição acontece somente no primeiro acesso ou ao clicar no botão, com limite rígido de 10 por colaborador/dia.
- O impacto no Lovable Cloud será baixo: uma consulta curta e até 10 atribuições por colaborador por dia.

## Validação

- Testar separadamente administrador, Parceiro Meta e colaborador comum.
- Confirmar que cada colaborador recebe no máximo 10 novos leads por dia.
- Simular cliques simultâneos e comprovar que nenhum lead é duplicado entre pessoas.
- Confirmar que leads do aquecimento podem entrar na esteira e que nenhuma chamada ao Google é feita.
- Testar checkbox, resultados, retorno agendado, filtros e histórico.
- Validar a visualização em computador e celular e conferir as proteções do banco.
