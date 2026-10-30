# Contributing to Pen & Paper

Thanks for helping. Pen & Paper is a calm paper for the thoughts you don't have time to write. Contributions of every size are welcome: a typo, a bug fix, a feature.

## How it works

1. **Open an issue first** for anything bigger than a small fix, so we agree on the idea before you spend time on it. Read [`PRODUCT.md`](PRODUCT.md) to see what the product is and why it works the way it does.
2. **Fork** the repository and create a branch from `main` (`fix/…`, `feat/…`).
3. Make your change. Keep it focused: one pull request, one idea.
4. Check it:
   ```bash
   npm install
   npx tsc --noEmit
   npm run lint
   npm test
   ```
5. **Open a pull request** against `main`. Fill in the template: what changed, why, and how you tested it. Add screenshots for anything visual.
6. The maintainer reviews it. Expect questions; that's normal. Once approved, the maintainer merges it.

Nobody pushes to `main` directly, the maintainer included: every change goes through a pull request, and only the maintainer can approve and merge.

## Run it locally

You need Node 24+ and a Postgres database (a free [Neon](https://neon.tech) branch works).

```bash
cp .env.example .env.local   # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate
npm run dev                  # http://localhost:3000
```

## Ground rules

- **Read [`AGENTS.md`](AGENTS.md)**: this project uses a recent Next.js with breaking changes.
- **Match the code around you**: naming, comments, and the plain, calm wording of the interface.
- **Database changes** are Drizzle migrations (`npm run db:generate`). They must only *add* (new columns with defaults, new tables), so old and new code can run side by side while a deploy rolls out.
- **Log decisions**: if your change adds a feature or changes how the product works, add an entry to the decision log in `PRODUCT.md`.
- **No secrets** in code, tests or screenshots. Never commit `.env.local`.
- **Be kind.** See the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Please don't open a public issue. See [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
