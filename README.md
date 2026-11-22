# PharmD Smart Hub — Local Offline Vendor Bundles (`./vendor/`)

These minified libraries are bundled locally alongside `index.html.html` and pre-cached by `sw.js` (`LOCAL_VENDOR_ASSETS`) so PDF export and OCR initialization do not wait on external CDNs when offline or on restricted networks.

| File | Library & Version | Purpose |
| --- | --- | --- |
| `jspdf.umd.min.js` | jsPDF `2.5.1` | Arabic/English PDF generation & English vector PDF fallback |
| `html2canvas.min.js` | html2canvas `1.4.1` | Native RTL/LTR Arabic & English HTML-to-PDF rendering |
| `tesseract.min.js` | Tesseract.js `5.0.4` | Client-side lab report OCR loader |

`_loadLibraryWithFallback()` in `index.html.html` checks `./vendor/<file>` first, then `./<file>`, and falls back to SW-cached CDN only if a local bundle is missing.
