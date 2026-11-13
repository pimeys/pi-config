# Global agent instructions

Ported from `~/.omp/agent/AGENTS.md` and `~/.omp/agent/RULES.md` so pi behaves the same way.

# VCS policy: jj is the only version control tool

This environment uses Jujutsu (jj) as its ONLY version control tool. The `git` binary and any raw `git ...` command are permanently disabled: every `git` tool call is denied before it executes. NEVER attempt `git`, never plan around it, never use it "just to check", never ask the user to run it.

Every VCS operation has a jj equivalent — use the jj form immediately:

| Goal | Run |
|---|---|
| see working-copy state / changed files | `jj status` |
| see history | `jj log` |
| see current change's diff | `jj diff` |
| fetch remote refs | `jj git fetch` |
| push | `jj git push` |
| record work and continue | `jj commit -m "msg"` (describes the working-copy change and opens a new one; no staging) |
| open a new change | `jj new -m "msg"` |
| fold working copy into parent (amend-like) | `jj squash` |
| move a change onto another base | `jj rebase` (e.g. `jj rebase -d main`) |
| undo the last operation | `jj undo` |
| edit a specific change | `jj edit <rev>` |
| see named refs | `jj bookmark list` |
| discard a change | `jj abandon` |

Repository shorthand you may use: `jj f` (fetch all remotes), `jj nt` (new commit on top of main), `jj ci -m "msg"` (commit), `jj git push`, `jj rebase -d main`, `jj undo`.

Allowed: `jj git ...` subcommands (`jj git push`, `jj git fetch`) — these are jj commands and are the correct git-interop seam. The `gh` CLI is allowed for GitHub interactions; assume commits/pushes happen via jj.

If you catch yourself about to type `git`, stop and issue the jj equivalent from the table above. A denied `git` call is a mistake, not a fallback path.

## SSH ControlMaster for hosts requiring hardware-key touch

SSH hosts that require a YubiKey (or other hardware key) touch per auth need a ControlMaster socket so you only touch once per session. Before connecting, check if a master socket already exists (another agent session may have opened one):

```bash
# Check for existing master socket
ssh -O check -S "$HOME/.ssh/cm/%r@%h:%p" <host> 2>/dev/null

# If none, open one (one touch):
ssh -M -S "$HOME/.ssh/cm/%r@%h:%p" -o ControlPersist=10m -fN <host>

# All subsequent commands reuse it — no touch:
ssh -S "$HOME/.ssh/cm/%r@%h:%p" <host> "<command>"
```

Always put sockets under `$HOME/.ssh/cm/` — never `/tmp/` on shared developer machines. Create the directory first: `mkdir -p ~/.ssh/cm`. Use the pattern `~/.ssh/cm/%r@%h:%p` so each host/user/port gets a unique socket that all agent sessions share.

## No Git! Use Jujutsu!

the version control is jj. important commands:

- jj f = fetch all remote branches
- jj nt = create a new commit on top of main
- jj ci -m = commit your changes
- jj git push = push your changes to main
- jj undo = undo your last action (you can repeat this)
- jj rebase -d main = rebase this branch on main

## JJ rebase conflict workflow

IMPORTANT: Preserve existing commit stack during rebases. Resolve conflicts commit by commit, bottom-up:

1. Rebase stack onto `main`.
2. Create resolution commit on top of first conflicted commit with `jj new <conflicted-commit>`.
3. Resolve that commit's conflicts and validate resolution.
4. Squash only resolution commit into conflicted parent with `jj squash`.
5. Continue to next conflicted commit and repeat.
6. Run final validation, then push rewritten stack.

When I say "squash" during rebase/conflict work, it means squash each conflict-resolution fix into its corresponding original commit. Never collapse entire branch history unless I explicitly say "squash into one commit" or equivalent.

Do not optimize conflict count by squashing original commits before rebase. Logical commit history must survive.

the rest you can see from jj help. remember to check my previous commit style
before commiting. it's usually in the form of "feat(twi-xxxx): description"

if you have an error/format issue/clippy issue in code that is "not written by you",
it's still your problem and you have to fix it.

IMPORTANT: Consider all tests being green before you started working on a thing. Any failed
tests, formatting issues or compilation issues must be fixed before committing.

IMPORTANT: If I explicitly make an operational call to push despite a local CI/test blocker
because CI should validate it or the machine has higher-priority work, do not argue with me.

## titan/monster shared-machine networking (netns, not magic)

`monster`/`titan*` per-user network isolation is implemented with Linux network namespaces
(`nix/hosts/modules/nixos/mixins/netns.nix`), not implicit per-user port ranges:

- Each dev user gets a dedicated netns `dev-$user`, joined to a shared bridge `br-devnet`
  (`10.42.0.0/16`) via a `veth<N>`/`vns<N>` pair, with a per-user IP `10.42.42.<hostOctet>`.
- Entering it requires `sudo enter-dev-netns` (or `run-dev-netns` as root) — you are not
  automatically inside it just by being logged in / running a shell as that user.
- `127.0.0.1` inside a dev netns is a distinct loopback from the host root namespace and from
  every other user's netns. That's why two users can each bind e.g. Postgres on
  `127.0.0.1:15432` with zero collision — different loopback interfaces, not port coordination.
- If a local connection (`nc`, `psql`, etc. to `127.0.0.1:<port>`) is refused even though
  `ps aux` shows a plausible same-user infra/process-compose process running: do not go
  spelunking through `/proc/<pid>` of other users' processes, and do not assume the topology
  is broken. First check whether the *current shell* is actually inside `dev-$user` (e.g.
  `ip netns identify $$`, or inspect the visible interfaces/IP) — namespace membership, not
  process ownership or cwd, determines what's reachable. The likely fix is running the check
  inside the right netns or starting the user's own infra stack, not debugging other users.

## Code navigation: LSP first, rg/sed second

If the string you are about to search for is an identifier — single token, `CamelCase`,
`snake_case` — call `lsp_workspace_symbols` / `lsp_document_symbols` first. It is one call and
returns the declaration with field types; `rg` needs `rg` + `read` and returns a file list.
`rg`/`sed` are for text with no symbol behind it: prose, log lines, config keys, languages with
no server, and cross-checking a result the LSP already produced.

Same for every other semantic operation — rename, find references, goto definition,
diagnostics, formatting, code actions — the `lsp_*` tool first; it is fewer tool calls and
cannot mis-attribute a symbol.

Hard rules:

- If unsure the server is up, run `lsp_status`. A cold rust-analyzer reports "No Server
  Instances started", and the *first* `lsp_find_references` on a file boots it and may return
  "No references found" with only warnings. That is a cold start, not a broken tool: retry the
  same query once (after indexing) before concluding anything.
- "The LSP returned nothing" means retry, then investigate. It never means "fall back to sed".
- Renames go `lsp_rename` → preview → `lsp_apply`. Never pattern-substitute a field, type,
  function, or parameter name across files: sed cannot tell a struct field from an identically
  named proto field, a function parameter, or an unrelated struct's field, and silently renames
  all of them (this has already produced two non-compiling edits).
- After any refactor: `lsp_diagnostics` on every touched file. rust-analyzer may not load every
  workspace package or root, and may not cover `#[cfg(test)]`, so confirm with
  `cargo check --all-targets` before calling it verified.
