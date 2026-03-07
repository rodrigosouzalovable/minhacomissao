import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, Terminal, Download } from 'lucide-react';
import { toast } from 'sonner';

const SERVER_JS_CODE = `// server.js - Robô CobMais com Playwright
// Execute: node server.js
// Requer: npm install express playwright cors

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let page = null;
let isRunning = false;
let currentStep = '';

// Inicia o navegador
async function initBrowser() {
  browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  console.log('✅ Navegador iniciado');
}

// Status
app.get('/status', (req, res) => {
  res.json({ 
    status: 'online', 
    online: true, 
    running: isRunning, 
    step: currentStep 
  });
});

// Execução principal
app.post('/automacao/cobmais', async (req, res) => {
  const { acao, parametros, cobmais_email, cobmais_senha } = req.body;

  if (acao !== 'gerar_boleto') {
    return res.json({ success: false, error: \\\`Ação '\${acao}' não suportada\\\` });
  }

  if (isRunning) {
    return res.json({ success: false, error: 'Já existe uma automação em execução' });
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const { cpf, valor_negociado, num_parcelas } = parametros || {};
    
    if (!cpf) throw new Error('CPF não informado');
    if (!valor_negociado) throw new Error('Valor negociado não informado');

    const cpfLimpo = cpf.replace(/\\\\D/g, '');

    console.log(\\\`\\\\n🚀 Iniciando geração de boleto\\\`);
    console.log(\\\`   CPF: \${cpfLimpo}\\\`);
    console.log(\\\`   Valor: R$ \${valor_negociado}\\\`);
    console.log(\\\`   Parcelas: \${num_parcelas || 1}\\\`);

    // PASSO 1: Verificar se está logado
    currentStep = 'Passo 1: Verificando login...';
    console.log(\\\`\\\\n[EXECUTANDO] \${currentStep}\\\`);

    try {
      await page.goto('https://app.cobmais.com.br/cob/pesquisa', { 
        waitUntil: 'networkidle', 
        timeout: 15000 
      });
    } catch (e) {
      console.log('⚠️ Timeout na navegação, verificando página...');
    }

    const currentUrl = page.url();

    if (currentUrl.includes('Account/Login') || currentUrl.includes('login')) {
      // PASSO 2: Fazer login
      currentStep = 'Passo 2: Fazendo login...';
      console.log(\\\`[EXECUTANDO] \${currentStep}\\\`);

      if (!cobmais_email || !cobmais_senha) {
        throw new Error('Credenciais do CobMais não configuradas');
      }

      await page.waitForSelector('input#Username', { timeout: 10000 });
      await page.fill('input#Username', '');
      await page.fill('input#Username', cobmais_email);

      await page.waitForSelector('input#Password', { timeout: 5000 });
      await page.fill('input#Password', '');
      await page.fill('input#Password', cobmais_senha);

      const btnEntrar = await page.$('button[type="submit"], input[type="submit"]');
      if (btnEntrar) {
        await btnEntrar.click();
      } else {
        await page.click('button:has-text("Entrar"), a:has-text("Entrar")');
      }

      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(3000);

      const afterLoginUrl = page.url();
      if (afterLoginUrl.includes('Login') || afterLoginUrl.includes('login')) {
        throw new Error('Falha no login - verifique usuário e senha');
      }

      console.log('✅ Login realizado com sucesso');
    } else {
      console.log('✅ Já estava logado');
    }

    // PASSO 3: Navegar para a pesquisa
    currentStep = 'Passo 3: Navegando para pesquisa...';
    if (!page.url().includes('/cob/pesquisa')) {
      await page.goto('https://app.cobmais.com.br/cob/pesquisa', { 
        waitUntil: 'networkidle', 
        timeout: 15000 
      }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // PASSO 4: Pesquisar CPF
    currentStep = \\\`Passo 4: Pesquisando CPF \${cpfLimpo}...\\\`;
    await page.waitForSelector('input#txtCPFCNPJ', { timeout: 10000 });
    await page.fill('input#txtCPFCNPJ', '');
    await page.fill('input#txtCPFCNPJ', cpfLimpo);
    await page.waitForSelector('#btnPesquisar', { timeout: 5000 });
    await page.click('#btnPesquisar');
    await page.waitForTimeout(3000);

    // PASSO 5: Selecionar o devedor
    currentStep = 'Passo 5: Selecionando devedor...';
    const resultSelector = [
      'table tbody tr:first-child td a',
      'table tbody tr:first-child',
      '#gridPesquisa tbody tr:first-child td a',
      'a[href*="telecobranca"]',
      'a[href*="Telecobranca"]',
    ];

    let clicked = false;
    for (const sel of resultSelector) {
      try {
        const el = await page.$(sel);
        if (el) { await el.click(); clicked = true; break; }
      } catch (e) { continue; }
    }

    if (!clicked) {
      try {
        await page.click(\\\`a:has-text("\${cpfLimpo.substring(0, 3)}")\\\`);
      } catch (e) {
        throw new Error('Nenhum resultado encontrado para o CPF');
      }
    }

    await page.waitForTimeout(4000);

    // PASSO 6: Selecionar parcelas
    currentStep = 'Passo 6: Selecionando parcelas...';
    const selectAllSelectors = [
      'input[type="checkbox"]#chkAll',
      'input[type="checkbox"][id*="chkAll"]',
      '#chkTodos',
      'th input[type="checkbox"]',
    ];

    let selectedAll = false;
    for (const sel of selectAllSelectors) {
      try {
        const el = await page.$(sel);
        if (el) { await el.click(); selectedAll = true; break; }
      } catch (e) { continue; }
    }

    if (!selectedAll) {
      const checkboxes = await page.$$('table tbody input[type="checkbox"]');
      for (const cb of checkboxes) {
        try { await cb.click(); await page.waitForTimeout(200); } catch (e) { continue; }
      }
    }

    await page.waitForTimeout(1000);

    // PASSO 7: Clicar em Cálculo
    currentStep = 'Passo 7: Abrindo cálculo...';
    const calcSelectors = [
      'button:has-text("Cálculo")',
      'button:has-text("Calculo")',
      'a:has-text("Cálculo")',
      '#btnCalculo',
      'button[id*="Calculo"]',
    ];

    let calcClicked = false;
    for (const sel of calcSelectors) {
      try {
        const el = await page.$(sel);
        if (el) { await el.click(); calcClicked = true; break; }
      } catch (e) { continue; }
    }

    if (!calcClicked) throw new Error('Botão "Cálculo" não encontrado');
    await page.waitForTimeout(3000);

    // PASSO 8: Preencher valor negociado
    currentStep = 'Passo 8: Preenchendo valor negociado...';
    const valorFormatado = parseFloat(valor_negociado).toFixed(2).replace('.', ',');
    await page.waitForSelector('input#txtValorFinal', { timeout: 10000 });
    await page.click('input#txtValorFinal', { clickCount: 3 });
    await page.fill('input#txtValorFinal', '');
    await page.type('input#txtValorFinal', valorFormatado, { delay: 50 });

    if (num_parcelas && num_parcelas > 1) {
      const parcelasSelectors = [
        'input#txtNumeroParcelas',
        'input[id*="parcela"]',
        'select#ddlParcelas',
      ];
      for (const sel of parcelasSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const tagName = await el.evaluate(e => e.tagName.toLowerCase());
            if (tagName === 'select') {
              await page.selectOption(sel, String(num_parcelas));
            } else {
              await page.click(sel, { clickCount: 3 });
              await page.fill(sel, '');
              await page.type(sel, String(num_parcelas), { delay: 50 });
            }
            break;
          }
        } catch (e) { continue; }
      }
    }

    await page.waitForTimeout(1000);

    // PASSO 9: Salvar o acordo
    currentStep = 'Passo 9: Salvando acordo...';
    let boletoUrl = null;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('gerapdf') || url.includes('GerarPDF') || url.includes('.pdf')) {
        boletoUrl = url;
      }
    });

    const context = page.context();
    context.on('page', async (newPage) => {
      const newUrl = newPage.url();
      if (newUrl.includes('gerapdf') || newUrl.includes('.pdf')) {
        boletoUrl = newUrl;
      }
      try {
        await newPage.waitForLoadState('networkidle', { timeout: 10000 });
        const finalUrl = newPage.url();
        if (finalUrl.includes('gerapdf') || finalUrl.includes('.pdf')) boletoUrl = finalUrl;
      } catch (e) {}
    });

    await page.waitForSelector('#btnSalvarCalc', { timeout: 5000 });
    await page.click('#btnSalvarCalc');
    await page.waitForTimeout(5000);

    // PASSO 10: Capturar URL do boleto
    currentStep = 'Passo 10: Capturando boleto...';
    if (!boletoUrl) {
      const printSelectors = [
        'a:has-text("Imprimir")',
        'button:has-text("Imprimir")',
        'a[href*="gerapdf"]',
        '#btnImprimir',
      ];
      for (const sel of printSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const href = await el.getAttribute('href');
            if (href && (href.includes('gerapdf') || href.includes('.pdf'))) {
              boletoUrl = href.startsWith('http') ? href : \\\`https://app.cobmais.com.br\${href}\\\`;
            } else {
              await el.click();
            }
            break;
          }
        } catch (e) { continue; }
      }
      await page.waitForTimeout(5000);
    }

    if (!boletoUrl) {
      const pages = context.pages();
      for (const p of pages) {
        const pUrl = p.url();
        if (pUrl.includes('gerapdf') || pUrl.includes('.pdf')) {
          boletoUrl = pUrl;
          break;
        }
      }
    }

    const tempo = Date.now() - startTime;

    if (!boletoUrl) {
      isRunning = false;
      currentStep = 'Erro: boleto_url não encontrada';
      return res.json({ 
        success: false, 
        error: 'Acordo possivelmente salvo, mas URL do boleto não foi capturada.',
        tempo_ms: tempo
      });
    }

    isRunning = false;
    currentStep = 'Concluído';

    return res.json({
      success: true,
      boleto_url: boletoUrl,
      tempo_ms: tempo
    });

  } catch (err) {
    const tempo = Date.now() - startTime;
    isRunning = false;
    currentStep = \\\`Erro: \${err.message}\\\`;
    return res.json({
      success: false,
      error: err.message || 'Erro desconhecido',
      tempo_ms: tempo
    });
  }
});

// Inicia servidor
const PORT = 3001;
initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(\\\`\\\\n🤖 Servidor Playwright rodando na porta \${PORT}\\\`);
    console.log(\\\`📡 Configure o ngrok: ngrok http \${PORT}\\\`);
    console.log('[IDLE] Pronto para automação\\\\n');
  });
}).catch(err => {
  console.error('❌ Erro ao iniciar navegador:', err);
  process.exit(1);
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
            <li>Execute: <code className="bg-muted px-1 rounded">npm install express playwright cors</code></li>
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
