---
name: jj-recipes
description: Jujutsu (jj) recipes — daily workflow, squash/edit/insert/restructure (new -A/-B, rebase), split/diffedit/absorb, undo & operation-log recovery, stacked changes & PR review, bookmarks & pushing, conflict resolution, workspaces & sparse. jj-only (raw git is disabled in this environment); commands verified against jj 0.43. Read this when a task involves any jj/VCS operation beyond jj status/jj new/jj commit.
---

# Jujutsu (jj) recipes

Environment: raw `git` is permanently disabled here — never reach for `git …`; use the `jj` forms below. `jj git fetch|push|clone` are jj commands and are allowed. `gh` is allowed. Repo shorthand from AGENTS.md: `jj f`, `jj nt`, `jj ci -m`, `jj rebase -d main`, `jj undo`. Everything here was verified against `jj 0.43.0` on this machine; `jj help <command>` is authoritative if your version differs.

## 0. User aliases on this machine (defined in `~/.config/jj/config.toml`)

The operator uses these daily — prefer them over the long forms:

- `jj f` — alias for `jj git fetch` (all remotes). Pulls new work in; nothing merges automatically.
- `jj nt` — alias for `jj new trunk()`, where `trunk()` = `latest(remote_bookmarks("main") | remote_bookmarks("master"))`. Opens a new change on top of the latest remote main/master — the standard starting point for new work.
- `jj tug` — alias for `jj bookmark move --from 'heads(::@- & bookmarks())' --to '@-'`. After finishing a change (typically right after `jj commit` or `jj new`), it moves the closest bookmark in your history up to that change so the branch points at what you just did — run it before `jj git push` (it counteracts the bookmark gotcha in §9).

## 1. Daily workflow

- `jj status` — working-copy state: changed files, new/untracked files, conflict warnings.
- `jj log` — change history.
- `jj diff` — diff of the current change.
- `jj new -m "desc"` — open a new (empty) change on top of the working copy and start editing it.
- `jj describe -m "desc"` (alias `jj desc`) — set/update the description of the working-copy change.
- `jj commit -m "msg"` (alias `jj ci`) — set the description AND open a fresh change on top (git-commit equivalent; there is no staging step).
- `jj f` / `jj git fetch --all-remotes` — fetch all remote refs; fetched work is visible without any merge step.

## 2. Squash workflow — move work into an earlier change

- `jj squash` — fold working-copy changes into the parent change.
- `jj squash -i` — choose hunks interactively, fold the ones you pick into the parent.
- `jj squash --into <rev>` — fold working-copy changes into an arbitrary change (amend-anywhere).
- `jj squash --from <src> --into <dst> [paths]` — move changes between two arbitrary revisions.
- `jj squash -r <rev>` — fold an earlier change into its parent (fails if that change is a merge).
- Note: jj rewires descendants automatically; a source change emptied by squash may be abandoned automatically.

## 3. Edit workflow — quick fix to an existing change

- `jj edit <rev>` — check out that change; subsequent edits amend it directly.
- `jj new` — after the fix, return to a fresh working-copy change (children of the edited change auto-rebase onto the fix).
- Docs prefer `jj new <parent>` + `jj squash` over `jj edit` when it is practical; `jj edit` is fine for quick fixes.

## 4. Inserting & restructuring

- `jj new -B @` — insert a new change BEFORE the working copy (a fix that should have come first; your in-progress change rebases on top of it).
- `jj new -A <rev>` — insert a new change AFTER `<rev>`.
- `jj rebase -r <rev> -d <newparent>` — move one change onto a new parent.
- `jj rebase -s <bottom> -d <newparent>` — move a whole stack (`<bottom>` = first change of the stack).
- `jj rebase -d main` — rebase the current change onto `main`.
- `jj duplicate <rev>` — duplicate a change (cherry-pick-style); then `jj rebase -r <dup> -d <target>` to place it.

## 5. Splitting & refining

- `jj split` — interactive diff editor: pick what stays in the first commit; the rest moves to a new child commit.
- `jj split <paths>` — non-interactive: the listed paths stay in the original change, everything else moves to a new child.
- `jj diffedit [-r <rev>]` — touch up hunks of a change with a diff editor.

## 6. Absorb — clean up a stack from the working copy

- `jj absorb` — move each working-copy hunk into the closest older change that introduced that line (auto-fixup of a stack).
- `jj absorb -i` — choose hunks interactively; unclaimed hunks stay in the working copy.

## 7. Undo & recovery — the operation log

- `jj undo` — revert the last operation; repeat to keep stepping back.
- `jj op log` — list operations; `jj op log -p` — with diffs.
- `jj op restore <op-id>` — restore the repo to an earlier operation's state.
- `jj --at-op <op-id> log` — inspect the repo as of an earlier operation (shorthand for `--at-operation`).
- `jj evolog [<rev>]` — see how a single change evolved across rewrites.
- `jj restore <paths>` — discard working-copy changes to those paths, restoring the parent's content.
- `jj restore` — restore the whole working copy from its parent; leaves the change empty but keeps description/metadata.
- `jj restore --from <rev> <paths>` — overwrite paths with their content from an older change.

## 8. Stacked changes & review

- Build: `jj new main -m "step 1"` → work → `jj new -m "step 2"` → …
- Fix a base change: `jj edit <base-id>` → fix → `jj new`; children auto-rebase onto the fix.
- Push & open PR: `jj git push --change @` (auto-creates a bookmark from the change and pushes), then `gh pr create --base main --head <bookmark-name>`.
- Stacked PRs: bookmark each level (`jj bookmark create feat/1 -r <id>`, …), push each (`jj git push --bookmark feat/1`, …), then `gh pr create --base <lower-bookmark> --head <upper-bookmark>` in stack order.
- Respond to review: `jj new <reviewed-change> -m "address feedback"` → fix → `jj squash --into <reviewed-change>` → `jj git push --bookmark <name>` (force-push is safe here — the operation log can undo it).

## 9. Bookmarks & pushing

- `jj bookmark list` (alias `jj b l`) — what exists and where it points.
- `jj bookmark create <name> [-r <rev>]` — new bookmark.
- `jj bookmark set <name> [-r <rev>]` — create or move.
- `jj bookmark advance` — move the closest matching bookmark(s) up to the current revision.
- `jj bookmark track <name>@origin` / `jj bookmark untrack <name>@origin`.
- `jj bookmark delete <name>` — delete, propagating the deletion on next push; `jj bookmark forget <name>` — stop tracking only.
- `jj git fetch --remote origin [--bookmark <name>]`.
- `jj git push --bookmark <name>` / `--change @` / `--all` (jj ≥ 0.41 may skip ineligible or conflicted bookmarks — check the output).
- Gotcha: bookmarks do NOT follow commits. After creating new commits, move the bookmark explicitly with `jj bookmark set <name>` (or use `jj git push --change @` / `jj bookmark advance` — or the `jj tug` alias in §0).

## 10. Conflicts

- `jj status` warns "There are unresolved conflicts"; `jj log` shows `×` on the conflicted change(s).
- jj markers are snapshot-plus-diffs (`<<<<<<<` / `%%%%%%%` / `+++++++` / `>>>>>>>` sections), not two-sided — edit the file to the content you actually want.
- Direct fix: edit the conflicted file(s) in the working copy; `jj diff` to review; `jj status` confirms "resolved".
- Merge tool: `jj resolve --tool <meld|vimdiff|kdiff3|…>` (3-way-resolvable conflicts only).
- Deferred resolution: keep building new changes on top of the conflicted change (`jj new …`); the resolution propagates to children automatically.
- Reviewable resolution (matches the AGENTS.md rebase-conflict workflow): `jj new <conflicted> -m "resolve conflicts"` → fix → `jj squash --into <conflicted>`.
- Recover: `jj undo` / `jj op restore <op-id>` if a conflict-creating operation was unwanted; `jj abandon <conflicted>` to drop the conflicted change.

## 11. Workspaces & sparse (advanced)

- `jj workspace add <dir>` — second working copy attached to the same repo (run a build in one while editing in the other); commits are shared, working copies are separate.
- `jj workspace list` / `jj workspace forget <name>` (then remove the directory).
- `jj sparse set --clear --add <path>` / `jj sparse list` / `jj sparse reset` — limit which paths exist in the working copy (monorepos).
- `jj util gc` — backend garbage collection / pack refs when the repo feels slow.
- `jj log --limit 20` — clamp long histories.

## Sources

- Official docs: https://docs.jj-vcs.dev/latest/ (tutorial, "Jujutsu for Git experts", CLI reference)
- Steve Klabnik, Jujutsu Tutorial: https://steveklabnik.github.io/jujutsu-tutorial/ (squash & edit workflows)
- Evan Martin, Common workflows: https://evmar.github.io/jjtut/workflows/ (pause/insert/staging habits)
- "Practical Workflows Guide" (community; techsaint/jj-vcs-skills, derived from nocksock/superpowers)
- Danver Braganza, "My most frequently used Jujutsu VCS commands" — the `tug` alias: https://danverbraganza.com/writings/most-frequent-jj-commands
- zerowidth, "jj tips and tricks" / jj-vcs/jj#5568 (closest-bookmark advance): https://zerowidth.com/2025/jj-tips-and-tricks/
- Operator's aliases read from `~/.config/jj/config.toml` on this machine (`aliases.f`, `aliases.nt`, `aliases.tug`, revset alias `trunk()`)
- All commands verified locally against `jj 0.43.0` via `jj help <cmd>` on this machine.
