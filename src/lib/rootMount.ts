export type RootWindowMode = "main" | "temporary-info";

export function rootWindowModeFromUrl(href: string): RootWindowMode {
  try {
    return new URL(href).searchParams.get("window") === "temporary-info" ? "temporary-info" : "main";
  } catch {
    return "main";
  }
}

export function rootElementFromDocument(documentRef: Pick<Document, "getElementById">, id = "root") {
  const element = documentRef.getElementById(id);
  if (!element) throw new Error(`Missing #${id} root element.`);
  return element;
}
