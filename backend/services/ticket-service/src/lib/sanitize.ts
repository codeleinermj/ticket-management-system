import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "recursiveEscape",
};

export function sanitizeText(input: string): string {
  return sanitizeHtml(input, SANITIZE_OPTIONS).trim();
}
