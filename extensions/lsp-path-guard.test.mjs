import guard from "/home/julius/.pi/agent/extensions/lsp-path-guard.ts";

let handler;
guard({ on: (name, fn) => { handler = fn; } });

const call = (toolName, input, cwd = "/home/julius/cobb") =>
  handler({ toolName, input }, { cwd });

const inside = await call("lsp_apply", { preview_id: "x", mutation_manifest: [
  { operation: "modify", path: "/home/julius/cobb/domain/src/actions.rs" },
  { operation: "create", path: "/home/julius/cobb/domain/src/new.rs" },
]});
const outside = await call("lsp_apply", { preview_id: "x", mutation_manifest: [
  { operation: "modify", path: "/home/julius/.bashrc" },
]});
const outsideMove = await call("lsp_apply", { preview_id: "x", mutation_manifest: [
  { operation: "rename", path: "/home/julius/cobb/a.rs", destination_path: "/home/julius/b.rs" },
]});
const otherTool = await call("edit", { path: "/home/julius/.bashrc" });
const noManifest = await call("lsp_apply", { preview_id: "x" });

console.log("inside           :", JSON.stringify(inside));
console.log("outside          :", JSON.stringify(outside));
console.log("outside move     :", JSON.stringify(outsideMove));
console.log("unrelated tool   :", JSON.stringify(otherTool));
console.log("missing manifest :", JSON.stringify(noManifest));
