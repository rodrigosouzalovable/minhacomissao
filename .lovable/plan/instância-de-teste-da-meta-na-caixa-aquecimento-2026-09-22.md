# Instância de teste da Meta na caixa AQUECIMENTO

Adicionar ao cadastro da API Oficial Meta um modo específico para o número de teste fornecido pela Meta, permitindo usá-lo como **destino controlado** das mensagens de aquecimento e responder pelo IAGO dentro da caixa **AQUECIMENTO**.

## Limitação importante da Meta

O número de teste é um ambiente de homologação, não um número de produção. A Meta limita seus destinatários a poucos números previamente autorizados e não garante que esse tráfego aumente qualidade ou tier. O sistema tentará o fluxo solicitado, mas não contará esse número nas métricas de evolução de tier e mostrará claramente qualquer recusa oficial.

## O que será feito

1. **Toggle no cadastro da instância**
   - Incluir no diálogo **Nova instância Meta WhatsApp** o toggle **“Instância de teste da Meta — usar como destino do aquecimento”**.
   - Disponibilizar a mesma opção na edição da instância.
   - Ao ativar, vincular automaticamente a instância à caixa **AQUECIMENTO** e identificá-la visualmente como **TESTE META**.
   - Restringir essa configuração ao administrador.

2. **Isolamento total de campanhas reais**
   - A instância de teste nunca será escolhida para campanhas, prospecção, lembretes, recuperação de qualidade, escalonamento de BM ou cobrança de custos.
   - Ela não entrará no pool comercial, não será considerada GREEN/YELLOW/RED e não contará para promoção de tier.
   - O toggle terá função exclusiva de destino/atendimento de teste.

3. **Participação como destino do aquecimento**
   - Incluir o telefone da instância de teste entre os destinos da caixa AQUECIMENTO, junto aos números UAZAPI conectados.
   - Reutilizar a rotina atual de aquecimento, sem criar novo agendamento.
   - Manter o limite atual por destino, deduplicação, intervalo aleatório, janela permitida e bloqueio de domingo.
   - Não enviar grupos, status ou mensagens fora do fluxo individual.

4. **Recebimento e resposta pelo IAGO**
   - Inscrever o webhook da WABA ao salvar e validar se a instância consegue receber eventos.
   - Toda mensagem recebida nesse número será criada diretamente na caixa **AQUECIMENTO**.
   - A conversa será atribuída ao IAGO, que responderá pela API Oficial Meta dentro da janela de atendimento permitida.
   - Fora da janela de 24 horas, o sistema não tentará texto livre; exibirá a limitação oficial em vez de repetir envios.

5. **Teste de compatibilidade e proteção automática**
   - Após o cadastro, disponibilizar uma verificação controlada do webhook e do envio/resposta.
   - Se a Meta recusar o destinatário por não estar autorizado no ambiente de teste, expirar o token ou bloquear a resposta, registrar o motivo legível no card e pausar somente essa participação.
   - Nunca transformar falha técnica em sucesso nem afetar os demais números do aquecimento.

6. **Banco e segurança**
   - Adicionar uma marca própria para a instância de teste, com padrão desligado, mantendo RLS e permissões administrativas.
   - Proteger no servidor a separação entre teste e produção; não depender apenas do toggle da tela.
   - Registrar ativação, desativação, última validação e último erro sem expor o token.

7. **Validação final**
   - Cadastrar/editar uma instância com o toggle ativo e confirmar a tag **TESTE META** e a caixa AQUECIMENTO.
   - Confirmar que ela não aparece em seletores de campanhas nem é escolhida pelo pool comercial.
   - Enviar uma mensagem controlada para o número de teste, verificar a entrada no Inbox, a atribuição ao IAGO e a resposta oficial.
   - Validar o comportamento quando o remetente não estiver autorizado pela Meta e quando a janela de 24 horas estiver encerrada.

## Impacto de custo do Cloud

**Alerta:** cada mensagem recebida pelo número de teste poderá acionar uma resposta do IAGO e consumir IA. Não será criado novo cron, polling ou rotina contínua; o custo adicional ficará proporcional ao pequeno volume de testes e será limitado pelas regras atuais por destino. A aprovação deste plano também autoriza esse impacto controlado.

## Detalhes técnicos

- Tela principal: `src/pages/ConfigurarMeta.tsx`.
- Persistência: nova marca administrativa em `meta_whatsapp_instances`, além do vínculo com a pasta AQUECIMENTO.
- Entrada oficial: adaptar `meta-whatsapp-webhook` para preservar a pasta AQUECIMENTO e garantir a atribuição ao IAGO nessa modalidade.
- Destinos: adaptar `_shared/meta-aquecimento-alvo.ts` para aceitar UAZAPI conectada e instância Meta de teste validada como destinos distintos.
- Saída/resposta: manter Graph API para a instância Meta; não fingir que ela é UAZAPI nem chamar endpoints incompatíveis.
- Isolamento: filtrar a marca de teste em `pick-meta-instance`, campanhas, aquecimento Meta como remetente, recuperação e relatórios financeiros.
