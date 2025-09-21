# HTML Mindmap to PDF Plan

1. Understand current mindmap rendering and existing download workflow in `components/MindMapModal.tsx` and any related utilities (e.g., `lib/markmap-renderer.ts`).
2. Investigate current PDF export implementation and identify gaps preventing vector/selectable text output.
3. Research integration points for `@sparticuz/chromium` + `puppeteer-core` within the Next.js/Vercel environment (e.g., API routes, edge/serverless functions) and document constraints (binary sizes, launch args).
4. Design an approach to render the mindmap HTML in a headless Chromium instance and produce a vector-based PDF (likely via `page.pdf`).
5. Implement the backend route/utility to generate PDFs using the new stack, ensuring local dev compatibility.
6. Update the front-end download button to call the new backend endpoint and handle file response/download UX.
7. Validate output locally (PDF fidelity, text selectable, styling) and outline any required tests or manual verification steps.
8. Update README with deployment notes and usage instructions for the new PDF export.


## Progress Notes

- [x] Steps 1-4 completed during initial analysis; architecture chosen for puppeteer-based PDF rendering.
- [x] Backend route implemented with `@sparticuz/chromium` + `puppeteer-core`, including payload validation and Chromium path resolution.
- [x] Front-end download action now posts markup/styles to the new API and streams the PDF response.
- [ ] Validate PDF output across sample mind maps and document manual QA steps.
- [ ] Update README deployment instructions and troubleshooting notes for the PDF exporter.
