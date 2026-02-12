

## Plano: Adicionar secoes "Quem Somos", FAQ com Accordion e Footer completo

### O que sera adicionado

Baseado nas 3 imagens de referencia, serao adicionadas/melhoradas 3 secoes no `PortalConsulta.tsx`, adaptadas para o negocio (Grupo Altum + Souza e Ribeiro):

---

### 1. Nova secao "Quem Somos" (entre "Beneficios" e "Como funciona")

- Titulo "Quem somos" em destaque
- Texto descritivo adaptado: "O Portal de Acordos e a plataforma de gestao e recuperacao de credito da Souza e Ribeiro Advogados, **autorizada e homologada pelo Grupo Altum**, com foco nas melhores oportunidades de negociacao para seus clientes. Todo o processo e online, de forma rapida e segura."
- Logos da Souza e Ribeiro e do Grupo Altum lado a lado (como na referencia com Viventi + Itau)
- Fundo claro (branco) para contrastar com as demais secoes escuras

---

### 2. Melhorar secao "Perguntas Frequentes" com Accordion

Substituir os cards estaticos atuais por um accordion interativo (usando o componente `@radix-ui/react-accordion` ja instalado):

- Campo de busca no topo para filtrar perguntas
- Itens colapsaveis com seta (chevron) que expandem ao clicar
- Perguntas adaptadas ao negocio:
  - "Qual o objetivo do Portal de Acordos?"
  - "Recebi um contato sobre uma oportunidade de negociacao. Como consulto?"
  - "Meus dados estao seguros?"
  - "Como faco para negociar meu debito?"
  - "Qual o prazo de resposta?"
  - "Quem pode renegociar no portal?"
- Fundo branco/claro para contrastar (como na referencia)
- Link de navegacao no header atualizado para "Quem somos"

---

### 3. Footer completo e profissional

Substituir o footer simples atual por um footer completo (como na referencia):

- Logos da Souza e Ribeiro + Grupo Altum no topo do footer
- Links: "Politica de Privacidade" e "Antifraude" (podem ser placeholders por enquanto)
- Secao "Central de Atendimento" com telefone/WhatsApp
- Razao social: "Portal de Acordos e um servico da SOUZA E RIBEIRO ADVOGADOS" (adaptar CNPJ se fornecido, senao omitir)
- Localizacao: Goiania - GO (ou cidade correta)
- Fundo cinza escuro (como na referencia)

---

### Detalhes Tecnicos

**Arquivo modificado:**
- `src/pages/PortalConsulta.tsx`

**Componentes utilizados (ja instalados):**
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` de `@/components/ui/accordion`
- `Input` para campo de busca no FAQ
- Logos ja importados (`logo-grupo-altum.png`, `logo-souza-ribeiro.png`)

**Navegacao no header:**
- Adicionar link "Quem somos" nos links de navegacao

**Nenhuma dependencia nova necessaria.**

