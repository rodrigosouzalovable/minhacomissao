# Descontos por faixa de débito e máximo de parcelas (Layout à vista + parcelamento)

## O que muda para você
Na aba **Modelo Mensagem > Layout à vista + parcelamento**:

1. **Máximo de parcelas por credor**
   - Novo campo "Máximo de parcelas" ao lado do credor.
   - Novo Mundo passa a começar em **12x** (opções 2, 4, 8 e 12x). Você poderá trocar esse número quando quiser.
   - UME continua até 18x, também ajustável.
   - O nome no seletor mostra o máximo atual (ex.: "Novo Mundo (até 12x)").

2. **Faixas de desconto por valor do débito**
   - Novo quadro "Descontos por valor do débito", com linhas: **De R$ / Até R$ / Desconto à vista % / Desconto parcelado %**.
   - Botão **"+ Adicionar faixa"** e lixeira em cada linha. A última faixa pode ficar sem limite ("ou mais").
   - Exemplo inicial: até R$ 500 → X% / X%; acima de R$ 500 → X% / X% (você preenche).
   - Os campos atuais de desconto viram o **desconto padrão** para débitos sem faixa correspondente.
   - Configurações separadas por credor e salvas automaticamente neste navegador, como o texto do modelo.
   - Alerta se houver faixas sobrepostas.

3. **Planilha já configurada**
   - Ao importar e aplicar, cada cliente recebe o desconto da faixa do seu débito.
   - À vista, parcelamento e mensagem usam o percentual dessa faixa.
   - Nova coluna "Desconto aplicado" na prévia e na planilha baixada.

## Técnico
- `src/lib/gradeCredor.ts`: `gradeAte(credor, max)` filtra a grade base (Novo Mundo [2,4,8,12,16,20,24], padrão 12) e mantém o máximo como última opção; `descontoPorFaixa(valor, faixas, padrao)`.
- `LayoutVistaParcelamentoTab.tsx`: estado `config[credor] = { maxParcelas, faixas[] }` em localStorage (`layout-vista-parcelamento-config-v1`); `aplicar()` calcula por linha; `{desconto_vista}`/`{desconto_parcelado}` passam a usar o valor da linha.
- Sem banco nem custo de backend. Testes unitários para faixa (limites, ausência de faixa) e para o máximo de 12x.
