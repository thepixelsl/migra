import { isMigratedPageIndexable } from "./migratedSeoPolicy";

type BlogIndexEntry = {
  path: string;
  type: string;
};

export function shouldListBlogPost(entry: BlogIndexEntry) {
  return entry.type === "post" && isMigratedPageIndexable(entry.path);
}
