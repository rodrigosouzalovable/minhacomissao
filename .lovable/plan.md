

## Painel de Status do Aquecimento em Tempo Real

### O que será criado
Um painel visual e intuitivo na aba **Dashboard** que mostra claramente:
1. **Status ativo pulsante** — indicador animado verde mostrando "Sistema Ativo" quando há instâncias em aquecimento
2. **Próxima execução** — horário calculado da próxima execução do cron (a cada 30 min)
3. **Cards por número ativo** — para cada instância em aquecimento, mostrar: nome, fase, progresso do dia (barra visual X/Y mensagens), última mensagem enviada com horário, e estimativa da próxima
4. **Timeline visual** — as últimas interações do dia com ícones de tipo (texto/áudio/imagem) e status (enviado/respondido/falhou)

### Alterações

**`src/pages/Aquecimento.tsx`**
1. Carregar dados adicionais no `loadAll`:
   - Última interação de cada instância ativa (da tabela `whatsapp_aquecimento_interacoes`)
   - Próximos agendamentos (da tabela `whatsapp_aquecimento_agendamentos` com status AGENDADO)
   - Config de horário comercial (da tabela `whatsapp_aquecimento_config`)
2. Adicionar na aba Dashboard, abaixo dos cards de métricas:
   - **Banner de status**: fundo verde com ícone pulsante quando `emAquecimento > 0`, cinza quando 0. Texto: "Aquecimento ativo — próxima execução às HH:MM" (calculado: próximo slot de 30 min dentro do horário comercial)
   - **Grid de cards por instância ativa**: cada card mostra:
     - Nome do número e fase atual
     - Barra de progresso `interacoes_hoje / limite_diario`
     - Texto "Última msg: HH:MM — [conteúdo truncado]"
     - Texto "Próxima msg estimada: ~HH:MM" (baseado no próximo ciclo do cron)
   - **Mini-timeline**: últimas 5 interações do dia com ícones coloridos

### Detalhes técnicos
- O cron roda a cada 30 min (`:00` e `:30`). A próxima execução é calculada arredondando para o próximo slot de 30 min dentro do horário comercial configurado.
- Se fora do horário ou dia inativo, mostrar banner amarelo "Fora do horário — próxima execução amanhã às HH:00"
- Componente `Progress` do shadcn para barra visual de progresso diário
- Animação CSS `animate-pulse` no indicador verde de "ativo"

