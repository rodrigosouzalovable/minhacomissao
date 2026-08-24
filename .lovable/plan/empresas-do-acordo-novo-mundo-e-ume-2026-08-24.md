# Empresas do acordo: NOVO MUNDO e UME

## Como está hoje (verificado)

- Ao lançar um acordo (`NovoAcordo.tsx` e `NovoAcordoAdmin.tsx`), o campo "Empresa" tem dois botões: **UME | INADIMPLENTES** e **UME | APORTE**, e já vem marcado "UME | INADIMPLENTES" por padrão.
- Os rótulos vêm de `empresaLabels.ts`; no banco os valores gravados são `ume_novo_mundo` e `mundo_da_moda`.
- O cálculo de comissão já é o mesmo nas duas empresas (mesma tabela por faixa de atraso), com dois caminhos duplicados no código.
- A tabela de comissão do funcionário (2% até 60d, 3%, 4%, 6%, 8%, 10% acima de 721d) exibida no card "Sua Comissão" continua igual — não muda nada nela.

## O que muda

1. **Renomear as empresas**
   - "UME | INADIMPLENTES" passa a se chamar **NOVO MUNDO**.
   - "UME | APORTE" passa a se chamar **UME**.
   - Os valores gravados no banco permanecem os mesmos (`ume_novo_mundo` = NOVO MUNDO, `mundo_da_moda` = UME), para que todos os acordos antigos, relatórios, dashboards e exportações continuem funcionando sem migração de dados.

2. **Nenhuma empresa pré-selecionada**
   - No lançamento de acordo (usuário e admin), os dois botões começam desmarcados.
   - Só é possível salvar depois de escolher NOVO MUNDO ou UME; se o usuário tentar salvar sem escolher, aparece um aviso "Selecione a empresa/credor do contrato".
   - O cálculo de comissão na tela só aparece depois da escolha.
   - Na edição de acordo, o botão da empresa já gravada continua marcado como hoje.

3. **Comissionamento igual para as duas**
   - As duas empresas passam a usar exatamente a mesma tabela de comissão por faixa de atraso (a que já é usada hoje nos dois casos), com comissão aplicada em todas as parcelas.
   - Isso elimina a divergência de textos/caminhos "APORTE vs INADIMPLENTES" no cálculo e na geração de parcelas.

4. **Rótulos em todas as telas**
   - Detalhe do acordo, Acordos da equipe, Clientes, Comissões, exportações e relatórios passam a mostrar "NOVO MUNDO" e "UME" no lugar dos nomes antigos.

## Detalhes técnicos

- `src/lib/empresaLabels.ts`: `ume_novo_mundo → 'NOVO MUNDO'`, `mundo_da_moda → 'UME'`; sem fallback para o nome antigo.
- `src/pages/NovoAcordo.tsx` e `src/pages/NovoAcordoAdmin.tsx`: estado `empresa` passa a `'ume_novo_mundo' | 'mundo_da_moda' | null` iniciando em `null`; `calculo` retorna `null` enquanto a empresa não for escolhida; validação no submit antes do insert; botões usam `variant={empresa === X ? 'default' : 'outline'}`.
- Cálculo unificado em `calcularPercentualComissaoMundoDaModa` + `gerarParcelasMundoDaModa` para ambas as empresas (mesmo resultado atual), removendo os ramos duplicados e o `{empresa === 'mundo_da_moda'}` órfão.
- `src/pages/EditarAcordo.tsx`, `AcordoDetalhe.tsx`, `Clientes.tsx`, `EquipeAcordos.tsx`, `ImageDataExtractor.tsx` e as edge functions de relatório passam a usar `getEmpresaLabel` / os novos textos, sem mudar valores gravados.
- Nenhuma migração de banco necessária.
