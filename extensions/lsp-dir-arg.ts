/**
 * `lsp_*` tools take a FILE path, but the natural argument for a workspace-wide lookup is the
 * project root, and pi-lsp answers that with "no configured server matches <dir>". So when a
 * directory is passed, swap in a source file that a configured server actually handles.
 * Routing and the workspace root are then derived from that file, as intended.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function configuredExtensions(cwd: string): string[] {
	const extensions = new Set<string>();
	for (const file of [join(homedir(), ".pi", "agent", "settings.json"), join(cwd, ".pi", "settings.json")]) {
		try {
			const servers = JSON.parse(readFileSync(file, "utf8"))?.lsp?.servers ?? {};
			for (const server of Object.values<any>(servers))
				for (const language of server?.languages ?? [])
					for (const extension of language?.extensions ?? []) extensions.add(extension);
		} catch {}
	}
	return [...extensions];
}

function sourceFileIn(directory: string, extensions: string[]): string | undefined {
	if (extensions.length === 0) return undefined;
	const globs = extensions.flatMap((extension) => ["-g", `*${extension}`]);
	const found = spawnSync("rg", ["--files", "--no-ignore", "--hidden", "-g", "!node_modules", ...globs, "."], {
		cwd: directory,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
		maxBuffer: 8 * 1024 * 1024,
		timeout: 10000,
	});
	const first = found.stdout?.split("\n").find((line) => line.trim() !== "");
	return first === undefined ? undefined : resolve(directory, first);
}

export default function lspDirArg(pi: ExtensionAPI) {
	const resolved = new Map<string, string | null>();
	pi.on("tool_result", (event) => {
		if (event.toolName !== "lsp_workspace_symbols" || event.isError) return undefined;
		const text = event.content.map((part) => (part.type === "text" ? part.text : "")).join("");
		if (text.trim() !== "No symbols found.") return undefined;
		return {
			content: [
				{ type: "text", text: "No symbols found. A freshly started server indexes in the background and answers workspace/symbol from that index, so this first answer is not authoritative: run `sleep 45` and retry this exact call (measured on this repo: empty on the first call, hits after ~45s)." },
			],
		};
	});
	pi.on("tool_call", (event, ctx) => {
		if (!event.toolName.startsWith("lsp_")) return undefined;
		const input = event.input as { file_path?: unknown };
		if (typeof input.file_path !== "string") return undefined;
		const path = resolve(ctx.cwd, input.file_path);
		const extensions = configuredExtensions(ctx.cwd);
		let directory: string;
		try {
			directory = statSync(path).isDirectory() ? path : dirname(path);
		} catch {
			directory = dirname(path);
		}
		while (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
			const parent = dirname(directory);
			if (parent === directory) return undefined;
			directory = parent;
		}
		let start = directory;
		if (!resolved.has(start)) resolved.set(start, sourceFileIn(start, extensions) ?? null);
		while (resolved.get(start) == null) {
			const parent = dirname(start);
			if (parent === start) break;
			start = parent;
			if (!resolved.has(start)) resolved.set(start, sourceFileIn(start, extensions) ?? null);
		}
		const file = resolved.get(start);
		if (!file) return undefined;
		if (path === file) return undefined;
		if (existsSync(path) && extensions.includes(extname(path))) return undefined;
		input.file_path = file;
		return undefined;
	});
}
