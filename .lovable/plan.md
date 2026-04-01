

## Add Arabic Font Support (Noto Sans Arabic)

### What
Add Noto Sans Arabic as a fallback font so all Arabic text (boutique names, comments, etc.) renders correctly across the app.

### Changes

**1. `src/index.css`**
- Update the Google Fonts import to include `Noto+Sans+Arabic` with weights 400–700
- Update the CSS custom property `--font-body` to include `'Noto Sans Arabic'` as fallback
- Update the `body` rule to include the Arabic font

**2. No other files need changes** — the app already uses `var(--font-body)` for body text and `var(--font-display)` for headings, so updating the CSS variables propagates everywhere.

### Technical Detail

```css
/* Updated import line */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

/* Updated custom properties */
--font-display: 'Space Grotesk', 'Noto Sans Arabic', sans-serif;
--font-body: 'Inter', 'Noto Sans Arabic', sans-serif;
```

This is a CSS-only change with no functional impact.

