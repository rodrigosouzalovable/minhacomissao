

## O que falta implementar no Aquecimento

Apesar de a conversa anterior ter mencionado a implementação da etapa 5, o código do webhook `whatsapp-chatbot` **não contém nenhuma lógica de aquecimento**. Confirmei isso com busca no arquivo.

### Pendências obrigatórias

**1. Detecção de respostas de aquecimento no webhook `whatsapp-chatbot/index.ts`**
- Após identificar a instância e o telefone remetente, buscar na tabela `whatsapp_aquecimento_interacoes` uma interação recente (últimas 2h) com `status = 'ENVIADO'` onde o par origem/destino bate
- Se encontrar: atualizar para `RESPONDIDO`, calcular `tempo_resposta_segundos`, salvar `conteudo_resposta`
- Incrementar `respostas_recebidas` na tabela `whatsapp_aquecimento_instancias`
- Pular processamento normal do chatbot (não responder a mensagens de aquecimento)

### Pendências menores (melhorias)

**2. Log de interações sem nomes de origem/destino**
- A aba Log não mostra quem enviou para quem — precisa fazer join com `user_whatsapp_instances` para exibir os nomes

**3. Incremento de `dias_na_fase`**
- A Edge Function verifica `dias_na_fase` para progressão de fase mas nunca incrementa esse campo diariamente de forma independente — o incremento depende do reset de `interacoes_hoje`, que só ocorre se a instância receber interações

**4. Filtros na aba Log**
- Sem filtros de data ou status na interface — apenas mostra os 100 últimos registros

---

### Arquivos a editar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-chatbot/index.ts` | Adicionar bloco de detecção de aquecimento antes do processamento normal |
| `src/pages/Aquecimento.tsx` | Adicionar colunas Origem/Destino no log + filtros de data/status |
| `supabase/functions/whatsapp-aquecimento/index.ts` | Garantir incremento correto de `dias_na_fase` |

