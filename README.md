# PORT

An Astro framework for content-driven showcase sites. Its first site is a professional portfolio. Architecture rules are in [`INSTRUCTIONS.md`](INSTRUCTIONS.md), with a summary in `AGENTS.md` / `CLAUDE.md`. Decisions are recorded in [`docs/adr/`](docs/adr/).

## Requirements

Node.js 22.12 or newer, and npm.

## Commands

Run from the repository root:

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at `http://localhost:4321` |
| `npm run check` | Type-check (strict TypeScript, including `.astro` files) |
| `npm test` | Run the unit tests, then build the site and test the generated pages |
| `npm run build` | Build the static site into `dist/` |
| `npm run serve` | Build, then serve `dist/` on all interfaces at port 4321 |

`npm run start` serves an existing build without rebuilding. From another device on the network, use the host machine's LAN address.

## Editing the site

- Content (text, experience, skills, contact channels): `content/portfolio.json`
- Site behavior (public URL, theme, color mode, section order, navigation): `content/site-config.json`
- Theme tokens: `themes/minimal-dark.json`, which points to a color palette (`themes/aquamarine.json`; the earlier mauve palette is `themes/colors.json`) and `themes/typography.json`
- Images and downloadable files: `public/`

Every file is validated when the site builds or the dev server renders a page. Invalid data stops the build with an error that names the file, the field and the problem, for example:

```text
Could not load site (schema error):
  - content/portfolio.json → site.title.de: is required
  - content/portfolio.json → contact.channels[1].url: must be an absolute https:// URL
Correct the listed fields; the accepted shapes are defined in src/schemas/.
```

Rules to know:

- Unknown fields are rejected.
- Every text listed under a locale (`en`, `es`, `de`) must be present in all supported locales, and translated lists must have the same number of entries in each locale.
- External links must use `https://`.
- Local files are referenced with root-relative paths such as `/assets/resume.pdf`, and the file must exist in `public/`.
- Contact channels (`contact.channels`) are `email`, `whatsapp` (phone in international form, e.g. `+595 981 123456`) or `profile` (`github`/`linkedin` URL on that network's domain), shown in the order listed.
- Sections appear in the order of `layout.sections`; each enabled section takes its heading from the `navigation` entry that targets it.
- Set `publicUrl` in `content/site-config.json` once the site has a public address, to generate canonical and alternate-language links.
