// The panel's page: the same bars as the mod's band, drawn from the
// PanelModel the extension posts. Nothing here but placing boxes.

export function panelHtml(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const nonce = Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Token Watch</title>
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 12px 16px; }
  .rows { display: grid; grid-template-columns: max-content 1fr max-content max-content; column-gap: 12px; row-gap: 10px; align-items: center; max-width: 720px; }
  .label, .detail { color: var(--vscode-descriptionForeground); }
  .bar { display: flex; height: 8px; min-width: 120px; border-radius: 2px; overflow: hidden; }
  .bar span { display: block; height: 100%; flex-basis: 0; flex-shrink: 1; min-width: 0; }
  .percent { text-align: right; min-width: 3.5em; font-variant-numeric: tabular-nums; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 14px 0 0; padding: 0; list-style: none; color: var(--vscode-descriptionForeground); }
  .legend li { display: flex; align-items: center; gap: 6px; }
  .swatch { display: inline-block; width: 14px; height: 8px; border-radius: 2px; }
  .footer { margin-top: 18px; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
  .waiting { margin: 0 0 12px; color: var(--vscode-descriptionForeground); }
  .stale .rows, .stale .legend { opacity: 0.5; }
</style>
</head>
<body>
<p id="waiting" class="waiting" hidden></p>
<div id="rows" class="rows"></div>
<ul id="legend" class="legend"></ul>
<p id="footer" class="footer"></p>
<script nonce="${nonce}">
  const rowsEl = document.getElementById('rows')
  const legendEl = document.getElementById('legend')
  const footerEl = document.getElementById('footer')
  const waitingEl = document.getElementById('waiting')
  function text(tag, className, value, color) {
    const el = document.createElement(tag)
    el.className = className
    el.textContent = value
    if (color) el.style.color = color
    return el
  }
  function render(model) {
    document.body.classList.toggle('stale', model.waiting !== null && model.rows.length > 0)
    waitingEl.hidden = model.waiting === null
    waitingEl.textContent = model.waiting ?? ''
    rowsEl.replaceChildren()
    for (const row of model.rows) {
      rowsEl.append(text('span', 'label', row.label))
      const bar = document.createElement('div')
      bar.className = 'bar'
      for (const segment of row.segments) {
        const piece = document.createElement('span')
        piece.style.flexGrow = String(Math.max(0, segment.share) * 10000)
        piece.style.backgroundColor = segment.color
        bar.append(piece)
      }
      rowsEl.append(bar)
      rowsEl.append(text('span', 'percent', row.percent + '%', row.color))
      rowsEl.append(text('span', 'detail', row.detail))
    }
    legendEl.replaceChildren()
    for (const item of model.legend) {
      const li = document.createElement('li')
      const swatch = document.createElement('span')
      swatch.className = 'swatch'
      swatch.style.backgroundColor = item.color
      li.append(swatch, text('span', '', item.name + ' ' + item.tokens))
      legendEl.append(li)
    }
    footerEl.textContent = model.footer
  }
  window.addEventListener('message', event => {
    if (event.data && event.data.type === 'model') render(event.data.model)
  })
</script>
</body>
</html>`
}
