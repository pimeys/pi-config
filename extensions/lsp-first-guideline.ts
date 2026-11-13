/**
 * Put the "identifier search goes to the LSP" rule next to the search tools
 * instead of 100 lines into AGENTS.md, where it is read at startup and never
 * retrieved at the moment the tool choice is made.
 *
 * Rendered into the `<rules>` section while `bash`/`grep` are active
 * (see buildRules in pi's system-prompt). No tool calls, no blocking.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const RULE =
	"When a search string is an identifier (single token, CamelCase or snake_case), call lsp_workspace_symbols or lsp_document_symbols before the rg/grep in bash: it is one call returning the declaration with field types, where rg returns a file list and needs a follow-up read." +
	" Pass a file path, not a directory. A 'no symbols found', 'No configured server' or timeout result within the first minutes of a session means rust-analyzer is still building its index: retry the same LSP call (lsp_document_symbols on the likely file works immediately), never fall back to rg.";

export default function lspFirstGuideline(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		for (const tool of ["bash", "grep"]) {
			const guidelines = (event.systemPromptOptions.toolGuidelines[tool] ??= []);
			if (!guidelines.includes(RULE)) guidelines.push(RULE);
		}
	});
}
