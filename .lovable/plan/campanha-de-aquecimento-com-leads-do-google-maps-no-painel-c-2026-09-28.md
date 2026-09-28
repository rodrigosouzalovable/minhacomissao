# Campanha de aquecimento com leads do Google Maps no painel Campanhas

## Resultado esperado
- Ao abrir **Campanhas**, mostrar uma seção identificada como **Aquecimento · Leads Google Maps**, separada dos disparos comuns. Agrupar por dia e mostrar tentativas, envios, falhas e instâncias usadas; ao abrir um dia, mostrar os envios e seus estados sem apresentar uma campanha fictícia como se tivesse sido disparada pelo sistema de campanhas comuns.
- Adicionar um botão **Atualizar** no painel aberto. Abrir o painel também fará uma leitura atual; durante a atualização, indicar carregamento e evitar cliques repetidos. Não criar atualização automática periódica.
- Quando não houver envios no dia, mostrar claramente “Nenhum envio hoje” e a data do último envio, em vez de sugerir que existe uma campanha em andamento. Se a consulta falhar, mostrar o erro e permitir tentar novamente.

## Verificação necessária
- Os envios desse aquecimento ficam em um histórico próprio, não na lista de campanhas comuns. O histórico consultado não contém envios de leads em 28/09/2026; o último envio confirmado ocorreu em 23/09/2026. Antes de declarar a operação ativa, verificar execução e elegibilidade da rotina de aquecimento e distinguir “sem envio” de falha de carregamento. Não iniciar nem retomar disparos apenas para preencher o painel.
- Conferir o resultado com um perfil autorizado, inclusive ao abrir, atualizar e ver um dia sem envios.

## Detalhes técnicos e acesso
- Consultar `meta_aquecimento_destino_log` apenas sob a permissão administrativa já existente; preservar as restrições para parceiros e outros usuários. Filtrar `fonte='lead'`, usar período curto por padrão, paginação para os detalhes e dados mínimos para evitar consultas grandes. Aproveitar o índice por dia/instância; avaliar índice específico se a consulta medida exigir.
- Usar `refreshStatus` existente para campanhas comuns e uma leitura explícita separada para o aquecimento. Não criar linhas em `envio_meta_job` nem misturar métricas dos dois fluxos.

**Atenção a custos da Lovable Cloud:** abrir e atualizar fará consultas adicionais ao histórico; o impacto é proporcional aos cliques, sem novos agendamentos ou consultas recorrentes. O período limitado e a paginação reduzem esse custo. Uma eventual criação de índice pode ter custo temporário de manutenção e armazenamento, a ser avaliado apenas se necessário.
