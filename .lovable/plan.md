# Campanha da Casa dos Dados no painel Campanhas

## Resultado esperado
- Remover do botão **Campanhas** a lista técnica agrupada por dia mostrada na imagem.
- Usar somente os contatos da **Casa dos Dados**. A captação e os contatos do Google Maps continuarão desligados e não participarão desse envio.
- Criar a campanha real pelo fluxo do Certificado Digital, com nome como **Renovação Certificado — 1 ano — 28/09/2026**, e exibi-la como as demais campanhas: status, progresso, enviados, falhas, **Ver detalhes**, pausar, retomar, cancelar e excluir.
- Ao abrir Campanhas ou clicar em atualizar, reler a lista normal de campanhas. Não adicionar outra lista, atualização automática ou informações técnicas.

## Correção e início seguro
- Corrigir a criação da campanha para que o registro principal e seus destinatários sejam preparados antes do processador começar. Isso evita uma campanha aparecer como concluída sem destinatários.
- Manter as proteções atuais: somente números Meta conectados, GREEN/UNKNOWN, ativos, com `cnpj_atualizado_2` aprovado e limite diário individual; deduplicação por telefone e reserva exclusiva por instância.
- Após a correção, iniciar a campanha de hoje usando somente empresas da Casa dos Dados abertas exatamente há um ano. Se a base tiver menos contatos elegíveis que a soma das metas, enviar apenas os contatos realmente disponíveis e mostrar o total real.
- Não reativar Google Maps, não misturar o aquecimento antigo e não criar destinatários fictícios.

## Verificação
- Confirmar no painel que há somente o cartão normal da campanha, sem o histórico técnico da imagem.
- Abrir **Ver detalhes** e conferir que o total corresponde aos destinatários reais, com atualização, pausa, retomada e cancelamento funcionando.
- Confirmar no banco que cada destinatário da campanha possui vínculo com o lead da Casa dos Dados e com uma única instância.
- Validar desktop e celular com um perfil administrativo.

## Detalhes técnicos
- Reutilizar `envio_meta_job` e `envio_meta_job_item`, que já alimentam o painel padrão, e o fluxo `certificado-prospeccao-processar` para coleta, validação e reserva.
- Remover `AquecimentoLeadsCampanhas` do painel flutuante e substituir a decisão registrada em `AGENTS.md` pela regra Casa dos Dados.
- Corrigir a condição de corrida observada no job de 28/09: ele foi gravado com total 1, concluído e sem itens. A criação deve permanecer invisível ao processador até os itens e vínculos estarem prontos.

**Custo:** não será criada uma nova rotina recorrente. O processamento diário existente continuará; haverá cobrança da Casa dos Dados somente quando o estoque local for insuficiente e cobrança da Meta pelas mensagens realmente enviadas, limitada pelas metas diárias já configuradas.
