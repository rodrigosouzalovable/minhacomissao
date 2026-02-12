

## Plano: Redesign do Portal com Layout "Feirao de Acordos"

### Objetivo
Redesenhar a pagina principal (`PortalConsulta.tsx`) para seguir o layout da imagem de referencia, posicionando as logos do Grupo Altum e Souza e Ribeiro no header exatamente como os logos parceiros aparecem na referencia.

### Layout da Referencia (Feirao de Acordos)

A estrutura visual segue este formato:

```text
+------------------------------------------------------------------+
| [Logo Parceiro] [Logo Feirao] [Logo Parceiro]  Nav Links  Tel    |
+------------------------------------------------------------------+
|                                                                  |
|  [Badge grande com icone                  [Card branco          |
|   de handshake +                           "Consulte suas       |
|   "Portal de Acordos"]                     dividas"             |
|                                            CPF: [______]       |
|  Texto motivacional:                       [Consultar]          |
|  "Aproveite e coloque                                           |
|   sua vida financeira                                           |
|   em dia."                                ]                     |
|                                                                  |
|  "Condicoes                                                      |
|   Imperdiveis"                                                   |
|                                                                  |
+------------------------------------------------------------------+
|  Secoes: Beneficios | Como funciona | Duvidas                    |
+------------------------------------------------------------------+
|  Footer + WhatsApp flutuante                                     |
+------------------------------------------------------------------+
```

### O que sera feito

#### 1. Copiar as logos para o projeto
- `user-uploads://Gemini_Generated_Image_dcmat4dcmat4dcma-removebg-preview_1.png` -> `src/assets/logo-grupo-altum.png` (Logo Grupo Altum)
- `user-uploads://Design_sem_nome_60_-removebg-preview.png` -> `src/assets/logo-souza-ribeiro.png` (Logo Souza e Ribeiro)

#### 2. Redesenhar o Header
- Layout horizontal com as duas logos lado a lado (Souza e Ribeiro + Grupo Altum), como na referencia que mostra "Itau Parceiro" + "Feirao de Acordos" + "Viventi"
- Links de navegacao: Beneficios, Como funciona, Duvidas
- Telefone de contato no canto direito
- Fundo com cor solida ou gradiente (estilo laranja da referencia, adaptado para as cores do Grupo Altum - azul escuro)

#### 3. Redesenhar o Hero Section
- Layout em duas colunas (split layout):
  - **Coluna esquerda**: Badge grande estilizado "Portal de Acordos" com icone de handshake + texto motivacional ("Aproveite e coloque sua vida financeira em dia" / "Condicoes Imperdiveis")
  - **Coluna direita**: Card branco com titulo "Consulte suas dividas", campo CPF e botao "Consultar"
- Background com gradiente nas cores do Grupo Altum (azul escuro para verde)

#### 4. Manter secoes inferiores
- Secao "Como funciona" (3 passos)
- Secao "Beneficios"
- Footer com contatos

#### 5. Adicionar botao WhatsApp flutuante
- Botao verde fixo no canto inferior direito (como na referencia)
- Link direto para `wa.me/5562981089329`

### Detalhes Tecnicos

**Arquivos criados:**
- `src/assets/logo-grupo-altum.png` (copia do upload)
- `src/assets/logo-souza-ribeiro.png` (copia do upload)

**Arquivos modificados:**
- `src/pages/PortalConsulta.tsx` - Redesign completo do layout seguindo a referencia

**Nota sobre a logo do Grupo Altum:** A imagem enviada tem texto branco em fundo transparente, ideal para fundos escuros. Sera posicionada sobre o fundo azul escuro do header.

**Nota sobre a logo Souza e Ribeiro:** A imagem tem texto preto em fundo transparente. No header escuro, sera necessario aplicar um filtro CSS `brightness(0) invert(1)` para tornar branca, ou colocar sobre um fundo claro.

