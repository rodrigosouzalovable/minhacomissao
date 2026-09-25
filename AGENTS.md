# Decisões técnicas

- Edições de valor e vencimento de parcelas pendentes do próprio acordo são atômicas por RPC com verificação do dono e recálculo do total; gatilhos impedem mudanças diretas de campos restritos e de acordos alheios, preservando a edição administrativa.

- Leituras da Inbox Meta acionadas por eventos devem ser agrupadas e evitadas com a aba oculta; filtros por etiqueta e contagens de não lidas usam índices específicos para evitar consultas repetidas de alto custo.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- O calendário D+5 a D+30 do Certificado se repete em dias úteis enquanto a prospecção estiver ativa; a coleta não consulta a Casa dos Dados nos fins de semana para evitar consumo sem envio.
- A prospecção diária do Certificado distribui até 50 reservas por instância Meta CONNECTED com qualidade GREEN ou UNKNOWN e template aprovado; falhas de uma instância não encerram as reservas das demais.
