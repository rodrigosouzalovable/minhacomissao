import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseComprovanteAcordo } from './acordoDocumento';

GlobalWorkerOptions.workerSrc = pdfWorker;

export async function lerPdfAcordo(file: File) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 50) throw new Error('O PDF tem mais de 50 páginas. Selecione apenas o comprovante do acordo.');
    const lines: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      let lastY: number | undefined;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (lastY !== undefined && Math.abs(y - lastY) > 3 && line) { lines.push(line); line = ''; }
        line += `${item.str} `;
        lastY = y;
        if (item.hasEOL && line) { lines.push(line); line = ''; lastY = undefined; }
      }
      if (line) lines.push(line);
      page.cleanup();
    }
    const text = lines.join('\n');
    if (!text.trim()) throw new Error('Este PDF está digitalizado. Envie um print legível ou preencha manualmente.');
    return parseComprovanteAcordo(text);
  } finally {
    await task.destroy();
  }
}