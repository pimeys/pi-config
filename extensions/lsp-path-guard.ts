/**
 * Block LSP `apply` calls whose Mutation Manifest touches paths outside the
 * session's working directory. A language server proposes edits for arbitrary
 * paths; this keeps a rename/refactor inside the project you are working on.
 *
 * The manifest is rewritten to canonical absolute paths before `tool_call`
 * runs, so a plain prefix check is sound (no symlink resolution needed).
 */

import { resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Tools that write files and expose a Mutation Manifest. `lsp` is the legacy single tool. */
const APPLY_TOOLS = new Set(["lsp_apply", "lsp"]);

type ManifestEntry = {
	operation?: string;
	path?: string;
	destination_path?: string;
};

export default function lspPathGuard(pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (!APPLY_TOOLS.has(event.toolName)) return undefined;
		const manifest = (event.input as { mutation_manifest?: unknown }).mutation_manifest;
		if (!Array.isArray(manifest)) return undefined;

		const root = resolve(ctx.cwd);
		for (const entry of manifest as ManifestEntry[]) {
			for (const path of [entry.path, entry.destination_path]) {
				if (typeof path !== "string") continue;
				const absolute = resolve(root, path);
				if (absolute !== root && !absolute.startsWith(root + sep)) {
					return {
						block: true,
						reason: `LSP edit outside the project root ${root}: ${absolute} (${entry.operation ?? "operation"}). Run pi from that project to edit it.`,
					};
				}
			}
		}
		return undefined;
	});
}
