// Eén plek voor het laden van pdf.js met de worker uit de app zelf
// (public/pdfjs, gekopieerd bij de build) — werkt dus ook offline.
export async function laadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker-${pdfjsLib.version}.min.mjs`;
  return pdfjsLib;
}
