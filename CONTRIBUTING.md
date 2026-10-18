# Contributing

FindBack is an educational project maintained by [Shariar Joy](https://github.com/Shariar-Joy).
The source is publicly viewable with all rights reserved; see [LICENSE](LICENSE).
Contact the maintainer before proposing redistribution or substantial contributions.

## Report a problem

Search existing issues, then use the bug report or feature request template. Include
reproduction steps, expected behavior, and relevant versions. Use fictional people
and addresses. Remove credentials, cookies, reset links, and personal information
from screenshots and logs. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Development workflow

1. Follow the local setup in [README.md](README.md).
2. Create a branch such as `fix/private-photo-access` or `feat/district-filter`.
3. Keep changes focused; update the API/schema and deployment documentation when behavior changes.
4. Run backend tests, frontend tests, and the production build as documented in
   [docs/TESTING.md](docs/TESTING.md). Run the PostgreSQL and browser workflows for relevant changes.
5. Open a pull request with the problem, changed behavior, checks performed, and screenshots for UI changes.

The CI workflow repeats PostgreSQL integration tests, migration checks, frontend
tests/build, browser workflows, and container builds. CI runs without production secrets.
Preserve server-side permissions, private-by-default reporting, image sanitization,
CSRF protections, and transactional notification delivery.
