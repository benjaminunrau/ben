/**
 * - read: a required source file does not exist.
 * - parse: the file is not valid JSON.
 * - unsupported-version: `schemaVersion` is missing or no longer/not yet supported.
 * - schema: the data violates its schema.
 * - resolution: an identifier or cross-file reference points at nothing (or at the wrong thing).
 */
export type SiteLoadErrorKind = "read" | "parse" | "unsupported-version" | "schema" | "resolution";

export interface SiteLoadIssue {
  /** Path of the source file, relative to the project root. */
  readonly file: string;
  /** Location inside the file, e.g. "skills[0].items[1].icon"; empty for the whole file. */
  readonly path: string;
  readonly message: string;
}

const remedies: Record<SiteLoadErrorKind, string> = {
  read: "Create the file, or fix the identifier that points to it.",
  parse: "Fix the JSON syntax at the reported position.",
  "unsupported-version": "Set schemaVersion to a supported version (currently 1).",
  schema: "Correct the listed fields; the accepted shapes are defined in src/schemas/.",
  resolution: "Make the listed identifiers refer to existing, matching entries.",
};

export class SiteLoadError extends Error {
  readonly kind: SiteLoadErrorKind;
  readonly issues: readonly SiteLoadIssue[];

  constructor(kind: SiteLoadErrorKind, issues: readonly SiteLoadIssue[]) {
    const lines = issues.map((issue) => `  - ${issue.file}${issue.path ? ` → ${issue.path}` : ""}: ${issue.message}`);
    super(`Could not load site (${kind} error):\n${lines.join("\n")}\n${remedies[kind]}`);
    this.name = "SiteLoadError";
    this.kind = kind;
    this.issues = issues;
  }
}

/** Formats a validation path such as ["skills", 0, "id"] as "skills[0].id". */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") return `${formatted}[${segment}]`;
    return formatted ? `${formatted}.${String(segment)}` : String(segment);
  }, "");
}
