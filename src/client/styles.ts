/**
 * Palette stylesheet, injected as one <style> tag at plugin activation.
 * Same design-token families as ui-primitives Modal/Menu (mask-1 + blur,
 * layer-2 card, elevation-prominent, menu row styles, l2 scrollbar).
 */
export const PALETTE_CSS = `
.dsh-palette-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12vh 24px 24px;
}
.dsh-palette-mask {
  position: absolute;
  inset: 0;
  background: var(--dsw-alias-bg-mask-1);
  backdrop-filter: var(--dsw-mask-blur);
}
.dsh-palette-card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: min(60vh, 480px);
  overflow: hidden;
  border: 0;
  border-radius: 20px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.dsh-palette-search {
  margin: 0;
  padding: 13px 20px;
  border: 0;
  border-radius: 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: transparent;
  font: inherit;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
  outline: none;
}
.dsh-palette-search::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-palette-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}
.dsh-palette-group {
  padding: 8px 10px 4px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  color: var(--dsw-alias-label-caption);
}
.dsh-palette-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-palette-row[data-active='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-palette-row-main {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-palette-row-detail {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}
.dsh-palette-row-shortcut {
  flex: none;
  padding: 1px 5px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  font-size: 10px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-palette-row-hint {
  flex: none;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-palette-empty {
  padding: 20px 12px;
  font-size: 13px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-palette-note {
  padding: 8px 12px;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
}
.dsh-palette-note[data-kind='error'] {
  color: var(--dsw-alias-state-error-primary);
}
.dsh-palette-note[data-kind='recording'] {
  color: var(--dsw-alias-label-secondary);
}
.dsh-palette-footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-palette-footer-kbd {
  margin-left: auto;
  padding: 1px 6px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 5px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}
`

/** Install the palette stylesheet once per document; idempotent. */
export function installPaletteStyles(): void {
  if (document.querySelector('style[data-dsh-palette]') !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-dsh-palette', '')
  tag.textContent = PALETTE_CSS
  document.head.appendChild(tag)
}
