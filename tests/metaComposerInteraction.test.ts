import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

// Exercise the actual Vite-served composer without authenticating or sending WhatsApp messages.
const browserCheck = String.raw`
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright, expect

HTML = '''<html><head><link rel="stylesheet" href="/src/index.css"></head>
<body><div id="composer"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import {createRoot} from '/node_modules/.vite/deps/react-dom_client.js';
import {MetaComposer} from '/src/components/inbox/meta/MetaComposer.tsx';
const root=createRoot(document.getElementById('composer'));
window.sent=[];
window.props={disabled:false,enviando:false,placeholder:'Digite uma mensagem...',conversationKey:'a',onSend:t=>{window.sent.push(t);window.update({enviando:true});}};
window.update=patch=>{Object.assign(window.props,patch);root.render(React.createElement(MetaComposer,window.props));};
window.update({});
</script></body></html>'''

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        page=await browser.new_page(viewport={'width':1280,'height':1800})
        await page.route('**/__composer-interaction',lambda route:route.fulfill(body=HTML,content_type='text/html'))
        await page.goto('http://localhost:8080/__composer-interaction')
        field=page.get_by_role('textbox')
        send=page.get_by_role('button',name='Enviar mensagem',exact=True)
        await expect(field).to_be_focused()
        scenario=sys.argv[1]
        if scenario=='pending':
            await field.fill('Primeira mensagem')
            await send.click()
            await expect(field).to_be_focused()
            await expect(field).to_be_enabled()
            await field.fill('Próxima mensagem')
            await expect(send).to_be_disabled()
            await field.press('Enter')
            await expect(field).to_have_value('Próxima mensagem')
            assert await page.evaluate('window.sent')==['Primeira mensagem']
            await field.press('Shift+Enter')
            assert '\n' in await field.input_value()
            await page.evaluate('window.update({enviando:false})')
            await expect(send).to_be_enabled()
            assert 'Próxima mensagem' in await field.input_value()
        elif scenario=='activation':
            await field.fill('Texto da conversa anterior')
            await send.focus()
            await page.evaluate("window.update({conversationKey:'b'})")
            await expect(field).to_be_focused()
            await expect(field).to_have_value('')
        elif scenario=='disabled':
            await field.fill('Texto preservado')
            await page.evaluate('window.update({disabled:true})')
            await expect(field).to_be_disabled()
            await expect(send).to_be_disabled()
            assert await page.evaluate('window.sent')==[]
            await page.evaluate('window.update({disabled:false})')
            await expect(field).to_be_focused()
            await expect(field).to_have_value('Texto preservado')
        elif scenario=='dialog':
            await page.evaluate("""()=>{
              const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.dataset.state='open';
              const input=document.createElement('input');input.id='dialog-input';dialog.append(input);document.body.append(dialog);input.focus();
              window.update({conversationKey:'b'});
            }""")
            await expect(page.locator('#dialog-input')).to_be_focused()
            await page.evaluate('window.update({enviando:true})')
            await page.evaluate('window.update({enviando:false})')
            await expect(page.locator('#dialog-input')).to_be_focused()
        folder=Path('/tmp/browser/meta-composer');folder.mkdir(parents=True,exist_ok=True)
        await page.locator('#composer').screenshot(path=str(folder/(scenario+'.png')))
        print('Verified:',scenario)
        await browser.close()
asyncio.run(main())
`;

for (const [scenario, rule] of [
  ['pending', 'digitação e rascunho permanecem durante envio; Enter não reenvia'],
  ['activation', 'trocar conversa ativa o cursor e limpa o texto anterior'],
  ['disabled', 'restrição de envio permanece e habilitar ativa o cursor'],
  ['dialog', 'mudanças de envio não roubam foco de diálogos'],
]) {
  test(rule, () => {
    const result = spawnSync('python3', ['-c', browserCheck, scenario], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    expect(result.stdout).toContain(`Verified: ${scenario}`);
  }, 60_000);
}