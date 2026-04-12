---
name: pdf-margins-pixel-perfect
description: Generates high-fidelity PDF exports from DOM elements ensuring a single-page fit with generous internal margins (15mm+). Prevents content clipping and ensures archival-quality centering.
---

# PDF Margins Pixel-Perfect

This skill provides a bulletproof strategy for exporting complex UI components (like TRD tables or official reports) into a single-page PDF with professional internal margins. It avoids the inconsistencies of native browser printing.

## Core Principles

1. **Single-Page Constraint**: The exporter must always force the content into exactly one page, scaling the image down as much as necessary.
2. **Safe Zone Margins**: A minimum "Safe Zone" of **15mm** must be maintained on all four sides of the page.
3. **Capture Padding (onclone)**: To ensure borders look clean and lines aren't clipped, a white padding of **20px to 40px** should be injected into the DOM clone during capture.
4. **Full-Height Awareness**: Always use `scrollHeight` and `overflow: visible` during capture to include hidden content (like signature blocks).

## Technical Implementation (jsPDF + html2canvas)

### Capture Logic
- Use `html2canvas` with `scale: 3` for high resolution.
- Use the `onclone` option to add `padding` and `background: #ffffff` to the element.
- Force `height: auto` on the cloned element.

### Scaling Algorithm
1. Define `pdfWidth` and `pdfHeight` (Letter: 215.9mm x 279.4mm).
2. Define `MARGIN_MM = 15`.
3. Calculate `SafeZoneW = pdfWidth - (MARGIN_MM * 2)`.
4. Calculate `SafeZoneH = pdfHeight - (MARGIN_MM * 2)`.
5. Calculate scale factors:
   - `scaleX = SafeZoneW / ImageWidth`
   - `scaleY = SafeZoneH / ImageHeight`
6. Use `finalScale = Math.min(scaleX, scaleY)` to ensure the content stays within bounds.

## When to use this Skill
- When a user complains about "corte vertical" (vertical clipping).
- When the PDF content is "pegado a los bordes" (touching the edges).
- When multi-page output is not desired for official "single sheet" reports.
