/**
 * Hard-block the `git` binary for agent tool calls, pushing agents to jj as
 * the project VCS (see ~/.pi/agent/AGENTS.md).
 *
 * Ported from ~/.omp/agent/extensions/block-git.ts. Matches `git` only in
 * command position, so `jj git push` (a jj command) and prose that merely
 * mentions "git" keep working.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const stripPrefix = (s: string): string =>
	s
		.trim()
		.replace(/^(cd\s+(~|\S+)(\s|&&\s*))+/, "")
		.replace(/^(env\s+)?([A-Za-z_][A-Za-z0-9_]*=[^\s]+\s+)*/, "")
		.replace(/^sudo\s+/, "");

/** True when the text invokes git as a command (not as an argument). */
export function isGitCommand(text: string): boolean {
	for (const seg of text.split(/&&|\|\||;|\|/)) {
		const s = stripPrefix(seg);
		if (s.startsWith("jj ")) continue; // `jj git push` is a jj command
		if (/^(git|command\s+git|\.?\/?[\w./-]*\/git)(\s|$)/.test(s)) return true;
	}
	return false;
}

/** True when script code shells out to git. Prose that merely names a git
 * subcommand (e.g. a docstring saying "jj git push") must not match. */
export function isGitEval(code: string): boolean {
	return /(spawn|exec|system|subprocess|child_process|popen|run)[^;\n]{0,60}\bgit\b/.test(code);
}

/** git subcommand → unambiguous jj replacement, used to teach on denial.
 * Only entries with a clear jj analogue belong here; a wrong teaching
 * mapping is worse than none. `git add`/`checkout`/`switch`/`stash` are
 * deliberately absent (jj has no staging/stash; checkout is ambiguous). */
const GIT_TO_JJ: Record<string, string> = {
	status: "jj status",
	log: "jj log",
	diff: "jj diff",
	fetch: "jj git fetch",
	pull: "jj git fetch",
	push: "jj git push",
	commit: 'jj commit -m "msg"', // jj commit describes the working-copy change and opens a new one; there is no staging step
	amend: "jj squash",
	branch: "jj bookmark list",
	rebase: "jj rebase -d main",
};

/** Scans the same command surface as isGitCommand; for the first git
 * segment with a mapped subcommand, returns a reason naming the jj
 * equivalent. Otherwise falls back to baseReason. */
function gitDenialReason(command: string, baseReason: string): string {
	for (const seg of command.split(/&&|\|\||;|\|/)) {
		const s = stripPrefix(seg);
		if (s.startsWith("jj ")) continue;
		const m = s.match(/^(?:command\s+)?(?:\.?\/?[\w./-]*\/)?git(?:\s+--[\w-]+)*\s+([\w-]+)/);
		const jjCmd = m ? GIT_TO_JJ[m[1]] : undefined;
		if (jjCmd) {
			return `git is disabled — use jj. For \`git ${m![1]} ...\` run \`${jjCmd}\`. See ~/.pi/agent/AGENTS.md`;
		}
	}
	return baseReason;
}

const BASE_REASON = "git is disabled in this environment — use jj (see ~/.pi/agent/AGENTS.md)";

export default function blockGit(pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		if (event.toolName === "bash") {
			const cmd = String((event.input as { command?: unknown })?.command ?? "");
			if (isGitCommand(cmd)) {
				return { block: true, reason: gitDenialReason(cmd, BASE_REASON) };
			}
			return undefined;
		}

		if (event.toolName === "codemode" || event.toolName === "eval") {
			const input = (event.input ?? {}) as Record<string, unknown>;
			const code = String(input.script ?? input.code ?? input.python ?? input.js ?? "");
			if (isGitEval(code)) {
				return { block: true, reason: BASE_REASON };
			}
		}

		return undefined;
	});
}
