# Homepage screenshot

Drop one file here and the homepage shows it automatically, under the headline. No code change is needed. Until the file exists, the page shows a dashed "your screenshot goes here" frame.

| File | Shows |
| --- | --- |
| `web.png` | Pen & Paper in a browser, notes spread over a paper |

`.webp`, `.jpg` and `.jpeg` work too (for example `web.webp`). Any other file in this folder (`mac.png`, `chrome.png`) is ignored.

**Size:** 1600 x 1000 pixels (16:10). The frame crops to that shape, so a different shape gets trimmed at the edges.

**Tips**
- Use the paper background and the light theme.
- Hide personal notes. Use a few made-up thoughts.
- Keep the file under about 400 KB (export as WebP or a compressed PNG).
- The page reads this folder when it is built or served, so redeploy after adding the file, or reload the dev server.
