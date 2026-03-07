import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, Terminal, Download } from 'lucide-react';
import { toast } from 'sonner';

const SERVER_JS_CODE = `// server.js - Robô CobMais com Playwright
// Execute: node server.js
// Requer: npm install express playwright

const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ===== CONFIGURAÇÕES =====
const COBMAIS_URL = 'https://app.cobmais.com.br';
const PORT = process.env.PORT || 3001;

let browser = null;
let page = null;
let currentStatus = 'idle';
let currentMessage = '';

// ===== INICIALIZAR NAVEGADOR =====
async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({ 
      headless: false,
      args: ['--start-maximized']
    });
    const context = await browser.newContext({ 
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true 
    });
    page = await context.newPage();
    console.log('✅ Navegador iniciado');
  }
  return page;
}

// ===== HELPERS =====
function updateStatus(status, mensagem) {
  currentStatus = status;
  currentMessage = mensagem;
  console.log(\`[\${status.toUpperCase()}] \${mensagem}\`);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== ENDPOINT: STATUS =====
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    online: true,
    currentAction: currentStatus,
    message: currentMessage,
    timestamp: new Date().toISOString()
  });
});

// ===== ENDPOINT: SCREENSHOT =====
app.get('/screenshot', async (req, res) => {
  try {
    if (!page) {
      return res.json({ image: null, url: '', status: currentStatus });
    }
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
    const base64 = \`data:image/jpeg;base64,\${screenshot.toString('base64')}\`;
    res.json({ 
      image: base64, 
      url: page.url(), 
      status: \`\${currentStatus}: \${currentMessage}\` 
    });
  } catch (err) {
    res.json({ image: null, url: '', status: 'erro ao capturar tela' });
  }
});

// ===== ENDPOINT PRINCIPAL =====
app.post('/automacao/cobmais', async (req, res) => {
  const { acao, parametros, cobmais_email, cobmais_senha } = req.body;

  if (acao === 'gerar_boleto') {
    try {
      const result = await gerarBoleto(parametros, cobmais_email, cobmais_senha);
      res.json(result);
    } catch (err) {
      console.error('❌ Erro gerar_boleto:', err.message);
      res.json({ 
        success: false, 
        error: err.message,
        etapa: currentMessage 
      });
    }
  } else {
    res.json({ error: \`Ação desconhecida: \${acao}\` });
  }
});

// ===== FLUXO COMPLETO: GERAR BOLETO =====
async function gerarBoleto({ cpf, valor_final, tipo_pagamento, parcelas }, cobmais_email, cobmais_senha) {
  const pg = await initBrowser();
  const startTime = Date.now();

  if (!cpf) throw new Error('CPF não informado');
  if (!valor_final) throw new Error('Valor final não informado');

  const cpfLimpo = cpf.replace(/\\D/g, '');

  console.log(\`\\n🚀 Iniciando geração de boleto\`);
  console.log(\`   CPF: \${cpfLimpo}\`);
  console.log(\`   Valor: R$ \${valor_final}\`);
  console.log(\`   Parcelas: \${parcelas || 1}\`);

  // ── PASSO 1: Verificar se está logado ──
  updateStatus('executando', 'Passo 1: Verificando login...');

  try {
    await pg.goto(\`\${COBMAIS_URL}/cob/pesquisa\`, { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    });
  } catch (e) {
    console.log('⚠️ Timeout na navegação, verificando página...');
  }

  const currentUrl = pg.url();

  // ── PASSO 2: Login (se necessário) ──
  if (currentUrl.includes('Account/Login') || currentUrl.includes('login')) {
    updateStatus('executando', 'Passo 2: Fazendo login...');

    if (!cobmais_email || !cobmais_senha) {
      throw new Error('Credenciais do CobMais não configuradas');
    }

    // Seletores corretos: input#Username e input#Password
    await pg.waitForSelector('input#Username', { timeout: 10000 });
    await pg.fill('input#Username', '');
    await pg.fill('input#Username', cobmais_email);

    await pg.waitForSelector('input#Password', { timeout: 5000 });
    await pg.fill('input#Password', '');
    await pg.fill('input#Password', cobmais_senha);

    const btnEntrar = await pg.$('button[type="submit"], input[type="submit"]');
    if (btnEntrar) {
      await btnEntrar.click();
    } else {
      await pg.click('button:has-text("Entrar"), a:has-text("Entrar")');
    }

    await pg.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await delay(3000);

    const afterLoginUrl = pg.url();
    if (afterLoginUrl.includes('Login') || afterLoginUrl.includes('login')) {
      throw new Error('Falha no login - verifique usuário e senha');
    }

    console.log('✅ Login realizado com sucesso');
  } else {
    console.log('✅ Já estava logado');
  }

  // ── PASSO 3: Navegar para pesquisa ──
  updateStatus('executando', 'Passo 3: Navegando para pesquisa...');

  if (!pg.url().includes('/cob/pesquisa')) {
    await pg.goto(\`\${COBMAIS_URL}/cob/pesquisa\`, { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    }).catch(() => {});
    await delay(2000);
  }

  console.log('✅ Na página de pesquisa');

  // ── PASSO 4: Pesquisar CPF ──
  updateStatus('executando', \`Passo 4: Pesquisando CPF \${cpfLimpo}...\`);

  // Seletor correto: input#txtCPFCNPJ
  await pg.waitForSelector('input#txtCPFCNPJ', { timeout: 10000 });
  await pg.fill('input#txtCPFCNPJ', '');
  await pg.fill('input#txtCPFCNPJ', cpfLimpo);

  // Botão pesquisar: #btnPesquisar
  await pg.waitForSelector('#btnPesquisar', { timeout: 5000 });
  await pg.click('#btnPesquisar');

  await delay(3000);
  console.log('✅ Pesquisa realizada');

  // ── PASSO 5: Selecionar o devedor ──
  updateStatus('executando', 'Passo 5: Selecionando devedor...');

  const resultSelectors = [
    'table tbody tr:first-child td a',
    'table tbody tr:first-child',
    '#gridPesquisa tbody tr:first-child td a',
    'a[href*="telecobranca"]',
    'a[href*="Telecobranca"]',
  ];

  let clicked = false;
  for (const sel of resultSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.click();
        clicked = true;
        console.log(\`   Clicou no resultado: \${sel}\`);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!clicked) {
    try {
      await pg.click(\`a:has-text("\${cpfLimpo.substring(0, 3)}")\`);
      clicked = true;
    } catch (e) {
      throw new Error(\`CPF \${cpf} não encontrado no CobMais\`);
    }
  }

  await delay(4000);
  console.log('✅ Devedor selecionado');

  // ── PASSO 6: Selecionar parcelas ──
  updateStatus('executando', 'Passo 6: Selecionando parcelas...');

  const selectAllSelectors = [
    'input[type="checkbox"]#chkAll',
    'input[type="checkbox"][id*="chkAll"]',
    'input[type="checkbox"][id*="selectAll"]',
    '#chkTodos',
    'th input[type="checkbox"]',
  ];

  let selectedAll = false;
  for (const sel of selectAllSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.click();
        selectedAll = true;
        console.log(\`   Marcou selecionar todos: \${sel}\`);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!selectedAll) {
    const checkboxes = await pg.$$('table tbody input[type="checkbox"]');
    for (const cb of checkboxes) {
      try {
        await cb.click();
        await delay(200);
      } catch (e) {
        continue;
      }
    }
    if (checkboxes.length > 0) {
      console.log(\`   Marcou \${checkboxes.length} parcelas individualmente\`);
    } else {
      console.log('⚠️ Nenhuma parcela encontrada para selecionar');
    }
  }

  await delay(1000);
  console.log('✅ Parcelas selecionadas');

  // ── PASSO 7: Clicar em Cálculo ──
  updateStatus('executando', 'Passo 7: Abrindo cálculo...');

  const calcSelectors = [
    'button:has-text("Cálculo")',
    'button:has-text("Calculo")',
    'a:has-text("Cálculo")',
    'a:has-text("Calculo")',
    '#btnCalculo',
    'button[id*="Calculo"]',
    'input[value="Cálculo"]',
  ];

  let calcClicked = false;
  for (const sel of calcSelectors) {
    try {
      const el = await pg.$(sel);
      if (el) {
        await el.click();
        calcClicked = true;
        console.log(\`   Clicou em Cálculo: \${sel}\`);
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!calcClicked) {
    throw new Error('Botão "Cálculo" não encontrado na página');
  }

  await delay(3000);
  console.log('✅ Tela de cálculo aberta');

  // ── PASSO 8: Preencher valor negociado ──
  updateStatus('executando', \`Passo 8: Preenchendo valor R$ \${valor_final}...\`);

  const valorFormatado = parseFloat(valor_final).toFixed(2).replace('.', ',');

  // Seletor correto: input#txtValorFinal
  await pg.waitForSelector('input#txtValorFinal', { timeout: 10000 });
  await pg.click('input#txtValorFinal', { clickCount: 3 });
  await pg.fill('input#txtValorFinal', '');
  await pg.type('input#txtValorFinal', valorFormatado, { delay: 50 });

  if (parcelas && parcelas > 1) {
    const parcelasSelectors = [
      'input#txtNumeroParcelas',
      'input[id*="parcela"]',
      'input[id*="Parcela"]',
      'select#ddlParcelas',
      'select[id*="parcela"]',
    ];

    for (const sel of parcelasSelectors) {
      try {
        const el = await pg.$(sel);
        if (el) {
          const tagName = await el.evaluate(e => e.tagName.toLowerCase());
          if (tagName === 'select') {
            await pg.selectOption(sel, String(parcelas));
          } else {
            await pg.click(sel, { clickCount: 3 });
            await pg.fill(sel, '');
            await pg.type(sel, String(parcelas), { delay: 50 });
          }
          console.log(\`   Preencheu parcelas: \${parcelas}\`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  await delay(1000);
  console.log(\`✅ Valor preenchido: R$ \${valorFormatado}\`);

  // ── PASSO 9: Salvar o acordo ──
  updateStatus('executando', 'Passo 9: Salvando acordo...');

  let boletoUrl = null;

  pg.on('response', async (response) => {
    const url = response.url();
    if (url.includes('gerapdf') || url.includes('GerarPDF') || url.includes('boleto') || url.includes('.pdf')) {
      boletoUrl = url;
      console.log(\`   📄 URL do boleto capturada via response: \${url}\`);
    }
  });

  const context = pg.context();
  context.on('page', async (newPage) => {
    const newUrl = newPage.url();
    console.log(\`   📄 Nova aba aberta: \${newUrl}\`);
    if (newUrl.includes('gerapdf') || newUrl.includes('GerarPDF') || newUrl.includes('boleto') || newUrl.includes('.pdf')) {
      boletoUrl = newUrl;
    }
    try {
      await newPage.waitForLoadState('networkidle', { timeout: 10000 });
      const finalUrl = newPage.url();
      if (finalUrl.includes('gerapdf') || finalUrl.includes('.pdf')) {
        boletoUrl = finalUrl;
        console.log(\`   📄 URL final da nova aba: \${finalUrl}\`);
      }
    } catch (e) {}
  });

  // Seletor correto: #btnSalvarCalc
  await pg.waitForSelector('#btnSalvarCalc', { timeout: 5000 });
  await pg.click('#btnSalvarCalc');
  await delay(5000);

  // Verificar se CobMais pediu e-mail
  try {
    const emailError = await pg.$('text=e-mail, text=email, text=Email');
    if (emailError) {
      console.log('⚠️ CobMais pediu e-mail, preenchendo email@email.com...');
      const emailInputSelectors = [
        'input[type="email"]',
        'input[id*="email"]',
        'input[id*="Email"]',
        'input[name*="email"]',
      ];
      for (const sel of emailInputSelectors) {
        try {
          const el = await pg.$(sel);
          if (el) {
            await pg.fill(sel, 'email@email.com');
            console.log('   Preencheu e-mail');
            await pg.click('#btnSalvarCalc');
            await delay(5000);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
  } catch (e) {}

  console.log('✅ Acordo salvo');

  // ── PASSO 10: Capturar URL do boleto ──
  updateStatus('executando', 'Passo 10: Capturando boleto...');

  if (!boletoUrl) {
    const printSelectors = [
      'a:has-text("Imprimir")',
      'button:has-text("Imprimir")',
      'a:has-text("Boleto")',
      'button:has-text("Boleto")',
      'a[href*="gerapdf"]',
      'a[href*="boleto"]',
      'a[href*="GerarPDF"]',
      '#btnImprimir',
      'button[id*="Imprimir"]',
      'a[id*="Imprimir"]',
    ];

    for (const sel of printSelectors) {
      try {
        const el = await pg.$(sel);
        if (el) {
          const href = await el.getAttribute('href');
          if (href && (href.includes('gerapdf') || href.includes('.pdf'))) {
            boletoUrl = href.startsWith('http') ? href : \`\${COBMAIS_URL}\${href}\`;
            console.log(\`   📄 URL do boleto via href: \${boletoUrl}\`);
          } else {
            await el.click();
            console.log(\`   Clicou em: \${sel}\`);
          }
          break;
        }
      } catch (e) {
        continue;
      }
    }

    await delay(5000);
  }

  if (!boletoUrl) {
    const pages = context.pages();
    for (const p of pages) {
      const pUrl = p.url();
      if (pUrl.includes('gerapdf') || pUrl.includes('.pdf') || pUrl.includes('boleto')) {
        boletoUrl = pUrl;
        console.log(\`   📄 URL do boleto encontrada em aba: \${pUrl}\`);
        break;
      }
    }
  }

  const tempo = Date.now() - startTime;

  if (!boletoUrl) {
    console.log('❌ Boleto URL não capturada');
    updateStatus('erro', 'URL do boleto não encontrada');
    return {
      success: false,
      error: 'Acordo possivelmente salvo, mas URL do boleto não foi capturada. Verifique manualmente no CobMais.',
      tempo_ms: tempo
    };
  }

  console.log(\`\\n🎉 Boleto gerado com sucesso!\`);
  console.log(\`   URL: \${boletoUrl}\`);
  console.log(\`   Tempo: \${tempo}ms\`);

  updateStatus('sucesso', \`Boleto gerado! URL: \${boletoUrl}\`);

  return {
    success: true,
    sucesso: true,
    boleto_url: boletoUrl,
    mensagem: \`Boleto gerado com sucesso para CPF \${cpf}\`,
    tempo_ms: tempo
  };
}

// ===== INICIAR SERVIDOR =====
app.listen(PORT, async () => {
  console.log(\`\\n🤖 Servidor Playwright rodando na porta \${PORT}\`);
  console.log(\`📡 Configure o ngrok: ngrok http \${PORT}\\n\`);

  try {
    await initBrowser();
    updateStatus('idle', 'Pronto para automação');
  } catch (err) {
    console.error('Erro ao iniciar navegador:', err.message);
  }
});

// Cleanup ao fechar
process.on('SIGINT', async () => {
  console.log('\\n🛑 Fechando navegador...');
  if (browser) await browser.close();
  process.exit();
});`;

export function RoboCodeViewer() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SERVER_JS_CODE);
    setCopied(true);
    toast.success('Código copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const blob = new Blob([SERVER_JS_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server.js';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo server.js baixado!');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Código do Robô (server.js)
            </CardTitle>
            <CardDescription className="mt-1">
              Copie este código e salve como <code className="bg-muted px-1 rounded">server.js</code> no seu computador
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
            <Button size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copiado!' : 'Copiar Código'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <p className="text-sm font-medium">📋 Instruções rápidas:</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Copie ou baixe o código abaixo</li>
            <li>Salve como <code className="bg-muted px-1 rounded">server.js</code></li>
            <li>Execute: <code className="bg-muted px-1 rounded">npm install express playwright</code></li>
            <li>Execute: <code className="bg-muted px-1 rounded">npx playwright install chromium</code></li>
            <li>Inicie: <code className="bg-muted px-1 rounded">node server.js</code></li>
            <li>Configure o ngrok: <code className="bg-muted px-1 rounded">ngrok http 3001</code></li>
          </ol>
        </div>

        <ScrollArea className="h-[500px] rounded-md border bg-muted p-4">
          <pre className="text-xs text-primary font-mono whitespace-pre-wrap">{SERVER_JS_CODE}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
