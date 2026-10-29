# Homepage screenshots

The homepage hero is an auto-scrolling carousel of these screens: the front one sharp, its neighbours blurred beside it, a caption and dots under it. Drop files here and the page picks them up, with no code change.

| File | Shows | Slide |
| --- | --- | --- |
| `web` | The canvas, notes and videos spread over a paper | Canvas |
| `writer` | The writer open over the canvas, with the mic and language menu | Writer |
| `library` | Every paper as a preview card | Library |
| `search` | Searching every paper for a word | Search |
| `tonight` | Tonight's paper: one card to strike, keep or crumple | Tonight |
| `grid` | The same paper on the Grid canvas | Grid |
| `ruled` | The same paper on the Ruled canvas | Ruled |

Every name also takes a `-dark` twin (`web-dark`, `writer-dark`, ...) that shows in the dark theme; without it the light file shows in both. A slide appears only when its light file exists. When `grid` and `grid-dark` both exist, a last slide, "Light & dark", shows them split on a slant. With a single file there is no carousel, just the image.

`.png`, `.webp`, `.jpg` and `.jpeg` all work.

**Size:** 1600 x 1000 pixels (16:10). The frame crops to that shape.

**Tips**
- `web` and `web-dark` are two captures of the same "Notebook, Oct" sample paper (100% zoom, header visible, zoom control and Write pill hidden).
- Use made-up notes in the same sample notebook across the set, and the same positions in the light and dark pair.
- Keep each file under about 450 KB (JPEG quality 80-86).
- The page reads this folder when it is built or served, so redeploy after adding files, or reload the dev server.
