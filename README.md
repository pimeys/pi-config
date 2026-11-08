# pi agent config

Shared `~/.pi/agent`. Not a standalone project — this directory is what Pi reads.

Requires **Pi >= 1.5.0**. The packages listed in `settings.json` import
`@earendil-works/pi-ai/compat`, and `pi-mcp-adapter` declares
`@earendil-works/pi-ai ^0.99 || ^1.0`. An older Pi (for example a Nix-packaged 0.79.1)
fails with `Cannot find module '.../pi-ai/dist/index.js/compat'`.

- Nix: `nix profile upgrade pi`, or bump the flake input to `github:earendil-works/pi/v1.5.0`
- Managed install: `curl -fsSL https://pi.dev/install.sh | sh`, then `pi update`

Secrets are referenced, never stored:

- `~/.config/omp/coralbricks.key` — `auth.json`, provider key
- `~/.config/exa/api.key` — `mcp-adapter.json`, Exa `x-api-key`

New machine: clone into `~/.pi/agent`, create those two key files, start `pi` — it installs
every package declared in `settings.json` on startup.
