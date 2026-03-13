

# Plano: Substituir botao Meta por configurador de Mensagens de Lembrete

## Resumo
Remover o botao "Meta" da pagina Acionamento e substituir por "Mensagens de Lembrete". Ao clicar, abre um dialog onde o usuario configura os templates de mensagem para cada tipo de cobranca. As mensagens sao salvas no banco e usadas pela edge function no lugar dos textos hardcoded.

## 1. Criar tabela `lembrete_mensagens_templates`

```sql
CREATE TABLE public.lembrete_mensagens_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_lembrete text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean DEFAULT true,
  ordem int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tipo_lembrete, ordem)
);

ALTER TABLE public.lembrete_mensagens_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON public.lembrete_mensagens_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Tipos pre-definidos: `3_dias`, `dia_vencimento`, `vencido_d1`, `vencido_d2`, `vencido_d10`, `vencido_d11`, `vencido_d20`, `vencido_d30`, `vencido_generico`.

## 2. Criar componente `LembreteMensagensDialog.tsx`

- Dialog com tabs ou accordion para cada tipo de lembrete
- Cada tipo mostra um Textarea com a mensagem atual (pre-populada com o template padrao hardcoded)
- Variaveis disponiveis: `{nome_cliente}`, `{nome_operador}`, `{valor}`, `{data_vencimento}`, `{dias_atraso}`
- Botao "Adicionar mensagem" para criar templates extras por tipo
- Botao salvar que faz upsert na tabela
- Carrega templates existentes do banco ao abrir

## 3. Alterar `Acionamento.tsx`

- Remover botao Meta (linhas 1134-1142) e todo o dialog Meta (linhas 1860-1950)
- Remover states relacionados a meta: `metaDialogOpen`, `metaDiaria`, `metaMensal`, `recebidoDiario`, `recebidoMensal` e constantes `META_*`
- Adicionar botao "Mensagens de Lembrete" com icone `MessageCircle` no mesmo local
- Importar e renderizar o novo `LembreteMensagensDialog`

## 4. Alterar edge function `check-payment-reminders`

- Antes de montar mensagens, buscar templates do usuario na tabela `lembrete_mensagens_templates`
- Se existir template para o tipo, usar o texto do banco substituindo as variaveis
- Se nao existir, usar o texto hardcoded atual como fallback
- Substituicao de variaveis: `{nome_cliente}` -> nomeCliente, `{nome_operador}` -> primeiroNome, `{valor}` -> valorFormatado, `{data_vencimento}` -> dataFormatada, `{dias_atraso}` -> diasNum

## Resultado
O usuario podera personalizar cada mensagem de lembrete diretamente pela interface, sem precisar alterar codigo. Templates extras podem ser adicionados por tipo.

