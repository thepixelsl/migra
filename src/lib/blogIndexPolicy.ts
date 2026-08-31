import { isMigratedPageIndexable } from "./migratedSeoPolicy";

type BlogIndexEntry = {
  path: string;
  type: string;
};

/**
 * Relevant archived posts may remain discoverable in the Blog while their
 * separate page-level indexing review is still conservative.
 */
export const BLOG_DISCOVERABLE_ARCHIVE_PATHS = new Set([
  "/wie-sollte-man-hochzeitsfotos-sichern/",
]);

export function shouldListBlogPost(entry: BlogIndexEntry) {
  return (
    entry.type === "post" &&
    (isMigratedPageIndexable(entry.path) ||
      BLOG_DISCOVERABLE_ARCHIVE_PATHS.has(entry.path))
  );
}
