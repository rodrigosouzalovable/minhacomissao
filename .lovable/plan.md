

## Reorganizar aba Configurações + Adicionar gestão de Diálogos

### Contexto
Atualmente a aba Configurações renderiza todos os campos como JSON bruto em inputs de texto — confuso para iniciantes. Além disso, as **mensagens e áudios** que os WhatsApps usam para conversar ficam na tabela `whatsapp_aquecimento_dialogos` mas **não existe interface para gerenciá-los**. Vamos resolver ambos.

### Alterações no arquivo `src/pages/Aquecimento.tsx`

**1. Configurações com campos amigáveis (substituir o loop genérico de JSON)**

Em vez de mostrar JSON bruto, renderizar cada configuração com controles visuais específicos:

- **Limites por Fase**: 4 campos numéricos lado a lado (Fase 1, Fase 2, Fase 3, Fase 4) + campo "Aquecido"
- **Dias por Fase**: 4 campos numéricos (Fase 1 a 4)
- **Horário Comercial**: 2 inputs de hora (Início / Fim) + campo de texto para timezone
- **Dias Ativos**: 7 checkboxes (Dom, Seg, Ter, Qua, Qui, Sex, Sáb)
- **Delay Config**: campos numéricos para min/max delay
- **Demais configs**: manter input JSON como fallback

Cada seção terá um Card próprio com título e descrição explicativa em linguagem simples.

**2. Nova aba "Diálogos" (ou seção dentro de Configurações)**

Adicionar uma nova tab "Diálogos" (5ª aba) para gerenciar a tabela `whatsapp_aquecimento_dialogos`:

- Tabela listando: Tipo (texto/áudio), Conteúdo, Resposta Esperada, Fase Mínima, Ativo (switch), Ações
- Botão "Adicionar Diálogo" abre formulário inline ou dialog com:
  - Select: Tipo (Texto / Áudio)
  - Textarea: Conteúdo (mensagem de texto ou URL do áudio)
  - Textarea: Resposta esperada (opcional)
  - Input numérico: Fase mínima (1-4)
  - Switch: Ativo
- Botão de excluir/editar em cada linha
- CRUD via Supabase na tabela `whatsapp_aquecimento_dialogos`

### Layout das abas atualizado

```text
Dashboard | Números | Configurações | Diálogos | Log
```

### Resumo técnico

| O quê | Como |
|-------|------|
| Configs amigáveis | Renderizar campos específicos por `chave` em vez de JSON genérico |
| Aba Diálogos | CRUD na tabela `whatsapp_aquecimento_dialogos` existente |
| Arquivo editado | `src/pages/Aquecimento.tsx` (único arquivo) |

