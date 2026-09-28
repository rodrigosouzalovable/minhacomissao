# Controle de aquecimento dentro de cada instância Meta

## Resultado no card

Na aba **API Oficial Meta**, substituir o campo **“Enviadas hoje”** por um controle administrativo de **Aquecimento Certificado**.

Cada card mostrará, na mesma área de identificação:

- botão para **ativar ou desativar** a instância no aquecimento;
- progresso diário exclusivo do Certificado, por exemplo **18 / 50 enviadas**;
- campo numérico para aumentar ou diminuir a meta diária daquela instância;
- botão de salvar com estado de carregamento e confirmação;
- motivo legível quando a instância estiver marcada, mas não puder participar: qualidade fora de GREEN/UNKNOWN, desconectada, fora do pool ou sem o template aprovado.

O contador não usará o total geral “Enviadas hoje” da instância. Ele contará somente os contatos do Certificado reservados/enviados naquele dia e separará, quando necessário, enviados de ainda aguardando envio.

## Comportamento do controle

- O controle será visível e editável somente para administrador, preservando as permissões atuais.
- Ativar o aquecimento marcará a instância para o piloto da Casa dos Dados.
- Desativar impedirá novas reservas para essa instância. Mensagens já enviadas permanecem no histórico e reservas já colocadas na fila não serão apagadas silenciosamente.
- A meta será individual: uma instância poderá ter 30, outra 50 e outra 100 mensagens por dia.
- O valor inicial das instâncias será **50**, preservando o comportamento atual.
- Somente instâncias marcadas, conectadas, ativas no pool, com qualidade **GREEN ou UNKNOWN** e com `cnpj_atualizado_2` aprovado poderão receber novos contatos.
- Instâncias YELLOW, RED, restritas, pausadas ou sem template não serão forçadas a enviar.

## Aplicação da meta no mesmo dia

Ao salvar uma nova quantidade:

- o sistema descontará tudo que já foi reservado ou enviado pela instância naquele dia;
- se a meta aumentar, buscará e reservará imediatamente apenas o saldo faltante;
- usará primeiro os leads locais elegíveis e já confirmados no WhatsApp;
- consultará a Casa dos Dados somente se o estoque local não completar o saldo;
- manterá os CNAEs do piloto e as janelas D+5, D+10, D+15, D+20, D+25 e D+30;
- nunca repetirá CNPJ, telefone, blacklist ou opt-out já utilizados;
- se a meta diminuir para menos do que o realizado no dia, não desfará envios; o novo limite passa a bloquear novas reservas e valerá integralmente no próximo dia útil.

A atualização reaproveitará o processamento existente e não criará novo agendamento ou consulta contínua.

## Segurança e consistência

- Guardar a meta diária em cada instância, com limite validado no banco entre **1 e 500**.
- Preservar a marcação atual de aquecimento e migrar as instâncias existentes com meta 50.
- Corrigir o processamento automático para considerar exclusivamente instâncias com a marcação ativa; hoje o modo Casa dos Dados ainda pode selecionar números aptos sem essa marcação.
- Calcular e reservar o saldo de forma atômica para evitar que dois salvamentos ou o ciclo automático ultrapassem a meta individual.
- Revalidar conexão, qualidade, pool e template imediatamente antes da reserva e novamente no envio.
- Isolar a falha de uma instância sem interromper as demais.

## Validação

- Ativar e desativar pelo card e confirmar que o estado permanece após atualizar a página.
- Alterar 50 para uma meta maior e confirmar a complementação imediata somente do saldo.
- Reduzir a meta abaixo do realizado e confirmar que nenhum envio anterior é desfeito nem outro é reservado.
- Confirmar o progresso correto para reservas, enviados, entregues, lidos, respondidos e falhas.
- Testar uma instância GREEN apta, uma UNKNOWN apta, uma RED/YELLOW e uma sem template.
- Confirmar que usuário não administrador não consegue alterar marcação ou meta, inclusive por requisição direta.
- Validar o card em desktop e celular e conferir a campanha criada sem disparar contatos duplicados.

## Alerta de custo Lovable Cloud

Aumentar a meta em um card poderá iniciar no mesmo dia novas verificações, consultas à Casa dos Dados e envios Meta. O custo cresce conforme o saldo adicional solicitado e a falta de estoque local. A implementação priorizará leads já armazenados, não criará novo cron, polling ou canal em tempo real e só acionará a busca ao salvar uma meta maior ou no ciclo diário existente.
