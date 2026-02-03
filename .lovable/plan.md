

## Plano: Extração Automática de Dados via IA com Upload de Imagem

### Objetivo

Adicionar uma funcionalidade na página "Novo Acordo" que permite:
1. Fazer upload ou colar uma imagem (print de tela do sistema legado)
2. Usar IA com visão computacional para extrair automaticamente os dados:
   - Nome do cliente
   - CPF
   - Telefone (primeiro número)
   - Valor total do acordo
   - Número e valor das parcelas
   - Data do primeiro pagamento
   - Dias em atraso
3. Preencher automaticamente todos os campos do formulário

---

### Visão Geral da Implementação

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Página Novo Acordo                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Nova Aba] Preencher com IA                              │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  📷 Arraste uma imagem ou clique para selecionar    │  │  │
│  │  │     (Também aceita Ctrl+V para colar prints)        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [Extrair Dados com IA]                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Aba Existente] Preencher Manualmente                    │  │
│  │  (formulário atual permanece intacto)                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Arquitetura

```text
Frontend (NovoAcordo.tsx)
        │
        │ POST { image: base64 }
        ▼
Edge Function (extract-acordo-data)
        │
        │ POST com imagem
        ▼
Lovable AI Gateway (gemini-2.5-flash)
        │
        │ Extração estruturada via tool calling
        ▼
JSON com dados extraídos
        │
        ▼
Preenchimento automático do formulário
```

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/extract-acordo-data/index.ts` | Criar | Edge function para processar imagem com IA |
| `src/components/ImageDataExtractor.tsx` | Criar | Componente de upload de imagem e extração |
| `src/pages/NovoAcordo.tsx` | Modificar | Adicionar abas e integrar o novo componente |

---

### Detalhes Técnicos

#### 1. Edge Function: `extract-acordo-data`

Esta função receberá a imagem em base64 e usará o Gemini com visão para extrair os dados de forma estruturada.

**Prompt de sistema para IA:**
```
Você é um especialista em extrair dados de imagens de sistemas de cobrança.
Analise a imagem fornecida e extraia as seguintes informações:

1. Nome do cliente (nome completo em letras maiúsculas)
2. CPF (formato XXX.XXX.XXX-XX)
3. Telefone (primeiro número encontrado, formato (XX) XXXXX-XXXX)
4. Valor total do acordo (em reais, ex: R$ 858,20)
5. Número de parcelas e valor individual (ex: 7x R$ 122,60)
6. Data do primeiro pagamento (formato DD/MM/AAAA)
7. Dias em atraso (número inteiro)
```

**Extração estruturada usando tool calling:**
```typescript
body.tools = [{
  type: "function",
  function: {
    name: "extract_acordo_data",
    description: "Extrai dados do acordo da imagem",
    parameters: {
      type: "object",
      properties: {
        cliente_nome: { type: "string" },
        cliente_cpf: { type: "string" },
        cliente_telefone: { type: "string" },
        valor_total: { type: "number" },
        parcelas: { type: "number" },
        valor_parcela: { type: "number" },
        data_primeiro_pagamento: { type: "string" },
        dias_atraso: { type: "number" }
      },
      required: [...]
    }
  }
}];
body.tool_choice = { type: "function", function: { name: "extract_acordo_data" } };
```

#### 2. Componente: `ImageDataExtractor`

**Funcionalidades:**
- Área de drag-and-drop para imagens
- Suporte a Ctrl+V (colar imagem da área de transferência)
- Botão para selecionar arquivo
- Preview da imagem selecionada
- Botão "Extrair Dados" que chama a edge function
- Loading state durante processamento
- Callback para preencher o formulário

**Estrutura do componente:**
```tsx
interface ExtractedData {
  clienteNome: string;
  clienteCpf: string;
  clienteTelefone: string;
  valorTotal: number;
  parcelas: number;
  valorParcela: number;
  dataPrimeiroPagamento: string;
  diasAtraso: number;
}

interface ImageDataExtractorProps {
  onDataExtracted: (data: ExtractedData) => void;
}
```

#### 3. Modificações em `NovoAcordo.tsx`

**Adicionar sistema de abas:**
```tsx
<Tabs defaultValue="manual">
  <TabsList>
    <TabsTrigger value="ai">
      <Sparkles className="mr-2 h-4 w-4" />
      Preencher com IA
    </TabsTrigger>
    <TabsTrigger value="manual">
      <FileText className="mr-2 h-4 w-4" />
      Preencher Manualmente
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="ai">
    <ImageDataExtractor onDataExtracted={handleDataExtracted} />
  </TabsContent>
  
  <TabsContent value="manual">
    {/* Formulário atual */}
  </TabsContent>
</Tabs>
```

**Handler para dados extraídos:**
```typescript
const handleDataExtracted = (data: ExtractedData) => {
  setForm({
    ...form,
    clienteNome: data.clienteNome,
    clienteCpf: formatCpf(data.clienteCpf),
    clienteTelefone: formatPhone(data.clienteTelefone),
    valorTotal: formatCurrencyDisplay(data.valorTotal),
    parcelas: data.parcelas.toString(),
    valorPrimeiraParcela: formatCurrencyDisplay(data.valorParcela),
    valorDemaisParcelas: formatCurrencyDisplay(data.valorParcela),
    dataPrimeiroPagamento: formatDateForInput(data.dataPrimeiroPagamento),
    diasAtraso: data.diasAtraso.toString()
  });
  
  // Mudar para aba manual para revisão
  setActiveTab('manual');
  
  toast({
    title: 'Dados extraídos com sucesso!',
    description: 'Revise as informações antes de salvar.'
  });
};
```

---

### Fluxo do Usuário

1. Usuário acessa "Novo Acordo"
2. Seleciona a aba "Preencher com IA"
3. Cola (Ctrl+V) ou arrasta um print de tela
4. Clica em "Extrair Dados"
5. IA processa a imagem e extrai os dados
6. Formulário é preenchido automaticamente
7. Usuário é redirecionado para aba "Manual" para revisar
8. Usuário ajusta se necessário e clica em "Criar Acordo"

---

### Tratamento de Erros

| Cenário | Tratamento |
|---------|------------|
| Imagem sem dados reconhecíveis | Toast de aviso solicitando imagem mais clara |
| Alguns campos não extraídos | Preencher parcialmente e destacar campos vazios |
| Rate limit (429) | Mensagem pedindo para aguardar |
| Créditos insuficientes (402) | Mensagem sobre adicionar créditos |
| Erro genérico | Toast de erro com opção de tentar novamente |

---

### Dados a Extrair (baseado na imagem fornecida)

| Campo | Localização na Imagem | Exemplo |
|-------|----------------------|---------|
| Nome | Topo, após o logo | NARLICE DA SILVA OLIVEIRA CARNEIRO |
| CPF | Abaixo do nome | 942.951.582-91 |
| Telefone | Tabela "Telefone", primeiro número | (91) 98137-1849 |
| Valor Total | "Valor: R$ X" no acordo | R$ 858,20 |
| Parcelas | "Parcelamento: Xx R$ Y" | 7x R$ 122,60 |
| Data 1º Pagamento | "Data:" no acordo | 03/02/2026 |
| Dias em Atraso | "Atraso:" na tabela de contratos | 290 |

---

### Resultado Esperado

- Interface intuitiva com duas abas (IA vs Manual)
- Upload de imagem por drag-and-drop, clique ou Ctrl+V
- Extração automática e precisa dos 8 campos principais
- Preenchimento instantâneo do formulário
- Revisão antes de salvar (aba manual)
- Economia de tempo significativa no cadastro de acordos

