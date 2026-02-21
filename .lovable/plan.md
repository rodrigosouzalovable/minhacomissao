

## Redesign Ultra Profissional da Pagina de Negociacao

### Visao Geral

Transformar a pagina `ConsultaResultado.tsx` e o componente `DiscountTierSelector.tsx` em uma experiencia visual de alto impacto, usando tecnicas de persuasao visual (ancoragem, urgencia, escassez, prova social) para maximizar a conversao de acordos. O layout sera completamente refeito com efeitos visuais modernos, tipografia impactante e hierarquia visual clara que direciona o cliente para o pagamento a vista.

---

### Mudancas no DiscountTierSelector.tsx

**Layout e Visual dos Cards de Oferta:**

- Card "A vista" sera 2x maior que os demais (ocupando linha inteira ou com destaque especial)
- Background com gradiente verde vibrante e borda pulsante (animacao CSS pulse) para o card a vista
- Badge "MELHOR OFERTA" maior, com animacao de brilho (shimmer effect)
- Icone de estrela dourada animado
- Valor com desconto em fonte 2xl-3xl, bold, cor verde neon (#00ff88)
- Valor original riscado em vermelho ao lado
- Economia em destaque: "Voce economiza R$ X,XX" em caixa verde
- Cards desabilitados com overlay escuro e cadeado visual
- Efeito hover com elevacao (shadow) e scale nos cards habilitados
- Texto persuasivo em cada card: "Quite agora!", "Parcele em ate 6x", etc.
- Contador visual de "economia perdida" nos cards parcelados (ex: "Desconto 10% menor")

**Hierarquia Visual:**
- Grid: card a vista em full-width no topo, demais em grid 3 colunas abaixo
- Separador visual entre a vista e parcelados com texto "ou parcele com desconto"

---

### Mudancas no ConsultaResultado.tsx

**Header da Pagina:**
- Saudacao mais acolhedora e personalizada com nome em destaque
- Badge "Oportunidade Exclusiva" ou "Oferta por tempo limitado" com animacao
- Icone de relogio pulsante sugerindo urgencia

**Cards de Debito:**
- Visual mais compacto com scroll horizontal em mobile ou accordion colapsavel
- Badge de "vencido" em vermelho nos debitos atrasados
- Valor em vermelho grande e negrito

**Secao de Valor Total:**
- Fundo com gradiente escuro premium
- Valor total em fonte extra grande (4xl-5xl) em vermelho
- Abaixo: "Mas voce pode pagar apenas..." com valor a vista em verde gigante
- Barra de progresso visual mostrando "quanto voce ja economizou"
- Selo de "Desconto Exclusivo" com efeito de brilho

**Formulario de Negociacao:**
- Caixa de destaque do valor com desconto: fundo com gradiente verde, valor enorme, confete visual sutil
- Resumo da negociacao em card premium com bordas douradas/verdes
- Botao "Confirmar proposta" maior, com gradiente verde vibrante e efeito de pulse
- Botao "TENHO UMA CONTRA PROPOSTA" estilizado mas secundario

**Secao de Confirmacao:**
- Animacao de check/sucesso ao confirmar
- Card de resumo com visual premium
- Botao WhatsApp grande e verde com icone animado

**Footer:**
- Selos de seguranca e confianca (LGPD, sigilo, etc.)

---

### Detalhes Tecnicos

**Arquivo: `src/components/negociacao/DiscountTierSelector.tsx`**

1. Reescrever o layout dos cards:
   - Card "a vista" em full-width com gradiente `linear-gradient(135deg, #00a86b, #00cc88)`, texto grande, badge animado
   - Cards parcelados em grid de 3 colunas com visual mais contido
   - Adicionar textos persuasivos: "Quite sua divida hoje!", "Economia maxima"
   - Adicionar animacao CSS `@keyframes pulse` para borda do card a vista
   - Adicionar animacao `@keyframes shimmer` para o badge "Melhor oferta"
   - Mostrar valor original riscado + valor com desconto lado a lado
   - Cards disabled com icone de cadeado e texto "Indisponivel para este valor"

2. Adicionar CSS inline para animacoes (keyframes via style jsx ou className com tailwind animate)

**Arquivo: `src/pages/ConsultaResultado.tsx`**

1. **Secao de saudacao** (linhas ~200-214):
   - Adicionar badge de urgencia animado
   - Texto mais persuasivo: "Aproveite esta oportunidade unica para regularizar sua situacao!"
   - Nome do cliente em fonte maior e bold

2. **Cards de debito** (linhas ~217-244):
   - Tornar colapsaveis (mostrar 2 e "ver mais X debitos")
   - Adicionar badge "Vencido" com cor vermelha

3. **Card de valor total** (linhas ~247-448):
   - Valor total em 4xl vermelho
   - Adicionar linha "Pague a vista por apenas" com valor 50% em verde 3xl
   - Destacar economia em badge verde
   - Formulario com spacing mais generoso e visual premium
   - Resumo com bordas verdes e fundo semi-transparente
   - Botao confirmar com gradiente e tamanho h-14
   - Selos de confianca no rodape do card

4. **Footer** (linhas ~454-460):
   - Adicionar icones de seguranca (Shield, Lock)
   - Texto sobre LGPD e sigilo

**Arquivo: `src/index.css`**

5. Adicionar keyframes CSS:
   - `@keyframes pulse-border` para borda pulsante verde
   - `@keyframes shimmer` para efeito de brilho no badge
   - `@keyframes float` para leve flutuacao de elementos de destaque

