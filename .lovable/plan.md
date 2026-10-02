# Odres Cred e nova comissão dos funcionários

## Objetivo

Adicionar **Odres Cred** como terceiro credor dos acordos e aplicar uma única tabela de comissão do funcionário para **Novo Mundo, UME e Odres Cred**:

| Dias de atraso | Comissão do funcionário |
|---|---:|
| 1 a 60 | 2% |
| 61 a 90 | 3% |
| 91 a 180 | 4% |
| 181 a 360 | 5% |
| 361 a 720 | 7% |
| 721 ou mais | 9% |

A mudança valerá para parcelas com pagamento confirmado a partir de **01/10/2026**, inclusive quando pertencem a acordos antigos. Pagamentos até **30/09/2026** conservarão a tabela anterior. Com 0 dias de atraso, a comissão continuará em 0%.

## O que será alterado

### 1. Terceiro credor nos acordos

- Registrar `odres_cred` como valor interno e exibir **ODRES CRED** no sistema.
- Mostrar **NOVO MUNDO | UME | ODRES CRED** nos lançamentos normal e administrativo, sem credor pré-selecionado e com escolha obrigatória antes de salvar.
- Incluir Odres Cred na edição de acordo e no seletor existente dos cards da equipe, mantendo exatamente as permissões atuais de quem pode alterar o credor.
- Incluir o terceiro credor em tags, filtros, detalhes, listas, relatórios e exportações que hoje reconhecem apenas Novo Mundo e UME.
- Atualizar a operação protegida de troca de credor para aceitar Odres Cred e continuar registrando toda alteração na auditoria.

### 2. Regra temporal da comissão do funcionário

- Centralizar o cálculo em uma função que receba valor da parcela, dias de atraso e data efetiva do pagamento.
- Para `data_paga >= 2026-10-01`, usar a nova tabela 2% / 3% / 4% / 5% / 7% / 9%, independentemente do credor.
- Para pagamentos anteriores, preservar a tabela histórica 2% / 3% / 4% / 6% / 8% / 10%.
- Para parcelas ainda pendentes, mostrar a projeção pela regra vigente desde outubro, sem alterar a data ou o status da parcela.
- Não modificar `comissao_parcela`, `percentual_comissao` ou `comissao_total`, pois esses campos representam honorários/comissão do escritório e devem permanecer intactos.

### 3. Telas financeiras e cards

- Ajustar **Minhas Comissões** e a visão administrativa de comissão para usar a data real de pagamento e apresentar o resumo de Odres Cred junto aos outros dois credores.
- Atualizar cards de acordo, filtros e arquivos Excel para mostrar Odres Cred sem agrupá-lo silenciosamente em outro credor.
- Corrigir o recálculo administrativo/exportações para que a coluna “Comissão Funcionário” use a mesma regra temporal da tela, eliminando divergências entre valores exibidos e exportados.
- Manter os totais recebidos, a comissão do escritório, pagamentos, parcelas e responsáveis sem alteração.

### 4. Documento do acordo

- Fazer o termo obrigatório identificar corretamente **Odres Cred** e impedir que ele reutilize por engano a marca de Novo Mundo ou UME.
- Enquanto não houver uma marca oficial fornecida para Odres Cred, usar identificação textual neutra no documento.

## Detalhes técnicos

- Não é necessária uma nova coluna: `acordos.empresa` já é texto e aceita um terceiro valor.
- A alteração de banco será aditiva na validação da função `alterar_credor_acordo`; a auditoria existente continuará registrando credor anterior, novo credor, autor e data.
- Os cálculos do funcionário serão separados dos honorários gravados nas parcelas. Toda chamada deverá informar `data_paga` para valores realizados.
- Acordos existentes não serão reclassificados para Odres Cred automaticamente; a mudança ocorrerá somente por seleção explícita e auditada.

## Validação

- Criar acordos dos três credores pelos fluxos normal e administrativo e confirmar que nenhum deles vem pré-selecionado.
- Trocar o credor na edição e no card autorizado, verificando auditoria e bloqueio para usuários sem permissão.
- Conferir as seis faixas de atraso nos três credores.
- Comparar uma parcela paga em 30/09/2026 com outra paga em 01/10/2026, comprovando a preservação histórica e a nova regra.
- Conferir tela, resumo por credor e Excel com os mesmos valores.
- Validar os cards e seletores em computador e celular, além do termo obrigatório de Odres Cred.
