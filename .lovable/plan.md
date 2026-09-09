# Correção do diálogo "Nova instância" na API Oficial Meta

## Problema
Na aba **API Oficial Meta**, ao clicar em **Nova instância**, o diálogo de cadastro excede a altura da tela e não permite rolagem. Isso impede o preenchimento dos campos inferiores (limite de mensagens, switches de aquecimento/cópia de templates etc.).

## Solução
Aplicar limite de altura e scroll vertical no conteúdo dos dois diálogos de instância que usam o mesmo padrão visual:

1. **Diálogo "Nova instância Meta WhatsApp"** (`src/pages/ConfigurarMeta.tsx`, linha ~1861)
   - Adicionar `max-h-[90vh] overflow-y-auto` ao `DialogContent`.
   - Manter `max-w-lg` e demais classes existentes.

2. **Diálogo "Editar instância"** (`src/pages/ConfigurarMeta.tsx`, linha ~1957)
   - Aplicar a mesma correção, pois possui a mesma estrutura e conteúdo extenso.

## Resultado esperado
O diálogo passa a ocupar no máximo 90% da altura da viewport e exibe barra de rolagem interna quando o conteúdo não cabe na tela, permitindo acessar todos os campos e botões.

## Arquivos alterados
- `src/pages/ConfigurarMeta.tsx`

## Validação
- Verificar build/typecheck após ajuste.
- Confirmar visualmente no preview que o diálogo não ultrapassa a tela e a rolagem funciona.
