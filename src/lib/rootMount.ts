export type RootWindowMode = "commit-info" | "main" | "temporary-info";

export function rootWindowModeFromUrl(href: string): RootWindowMode {
  try {
    const mode = new URL(href).searchParams.get("window");
    if (mode === "commit-info") return "commit-info";
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
