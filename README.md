# zhanggir_site

Personal site — Zhanggir Yessenaliyev. Robotics and autonomous systems, Purdue.

**Live:** https://jayzhan12-ops.github.io/zhanggir_site/

## What's here

| file | |
|---|---|
| `index.html` | the whole page |
| `styles.css` | all styling; the palette is the token block at the top of `:root` |
| `script.js` | gate, cursor, reveals, work plates, clock |
| `headshot.jpg` | portrait, 1000×989 |

No build step, no dependencies, no framework. Open `index.html` and it runs.
The only external request is Google Fonts (Instrument Serif + Space Grotesk);
everything degrades to a system stack offline.

## Editing

**Colours** — nine tokens at the top of `styles.css`. Changing `--accent`
recolours the whole site; `--accent-on-band` is its darker twin, used only
where the accent sits on the light Work band (the bright value fails contrast
there).

**The launch gate** — the ROS 2 command lives in the markup, in
`#gateCmd`. Change the text and the check follows it automatically; matching
ignores case, extra spaces and a pasted `$` prompt.

**Projects** — each row in `.rows` carries a `data-plate` naming which drawing
follows the cursor. The drawings are the `<svg class="pl">` blocks below.

## The CV

The Résumé link expects `zhanggir-yessenaliyev-cv.pdf` beside `index.html`.
It is deliberately **not** committed: the CV carries a phone number, and this
site is public and indexable. Drop a phone-free export in with that filename
and the link appears on its own — the page checks whether the file exists and
hides the link when it doesn't.

## Deploying

Pushes to `main` publish automatically once Pages is switched on
(Settings → Pages → Source: `main`, folder `/`).
