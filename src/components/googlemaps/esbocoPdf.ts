/** Captura o mockup renderizado e gera um PDF A4 multipágina. Tudo no navegador. */

export async function gerarPdfEsboco(el: HTMLElement, nomeEmpresa: string): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Altura, em pixels do canvas, que caberá em uma página A4 mantendo a proporção.
  const pxPorMm = canvas.width / pageW;
  const pageHpx = Math.floor(pageH * pxPorMm);

  let y = 0;
  let primeira = true;
  while (y < canvas.height) {
    const sliceH = Math.min(pageHpx, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!primeira) pdf.addPage();
    primeira = false;
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, sliceH / pxPorMm);
    y += sliceH;
  }

  const slug =
    nomeEmpresa
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 45) || "cliente";
  pdf.save(`esboco-site-${slug}.pdf`);
}
