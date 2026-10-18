# Security policy

The latest `main` branch receives fixes. This is an educational prototype; cloud
deployment and an independent security review remain necessary before real reports.

## Report a vulnerability privately

Use GitHub's **Security → Report a vulnerability** when enabled, or contact the
maintainer privately through [their GitHub profile](https://github.com/Shariar-Joy).
Do not include sensitive findings, account credentials, reset links, real case data,
or exploit details in public issues. Include reproduction steps using synthetic
data, affected versions, impact, and a suggested fix when available.

## Operational requirements

- Keep `.env`, AWS credentials, private keys, database dumps, and uploaded media out of Git.
- Use HTTPS, secure cookies, explicit origins, private object storage, and authenticated SMTP with verified TLS.
- Restrict database access, use IAM roles for AWS access, and keep bootstrap credentials temporary.
- Verify ownership, reviewer access, hidden/resolved media, and CSRF through the actual production ingress.
- Configure backups, restore tests, retention, support contacts, monitoring, and dependency updates.

See [AWS deployment](docs/AWS_DEPLOYMENT.md) and [deployment operations](docs/DEPLOYMENT.md).
