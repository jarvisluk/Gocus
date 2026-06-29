export type RootWindowMode = "changed-file-info" | "commit-info" | "function-menu" | "main" | "temporary-info";

export function rootWindowModeFromUrl(href: string): RootWindowMode {
  try {
    const mode = new URL(href).searchParams.get("window");
    if (mode === "changed-file-info") return "changed-file-info";
    if (mode === "commit-info") return "commit-info";
    if (mode === "function-menu") return "function-menu";
    return mode === "temporary-info" ? "temporary-info" : "main";
  } catch {
    return "main";
  }
}

export function rootElementFromDocument(documentRef: Pick<Document, "getElementById">, id = "root") {
  const element = documentRef.getElementById(id);
  if (!element) throw new Error(`Missing #${id} root element.`);
  return element;
}
