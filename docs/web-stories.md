# Web Stories

The first story lives at `/web-stories/paarshooting-hamburg-september-2026/`.
It is a standalone AMP document rendered by Astro, with a self-referencing
canonical URL. It uses no ordinary site JavaScript or analytics components.

- Content and image order: `src/data/webStories.ts`.
- Reusable white-mat layout: `src/components/WebStory.astro`.
- Optimized images: `public/images/web-stories/`.
- Editorial SEO entry: `src/data/pageSeo.mjs`.
- Discovery: portfolio link, the general production sitemap and the dedicated
  `/web-story-sitemap.xml` advertised in `robots.txt`. The SEO build step discovers
  indexable, self-canonical standalone AMP stories automatically.

The September 2026 story has 12 pages and 13 different photographs. The supplied
`IMG_3926.JPG` and second `ART_8893` export repeat motifs already included, so
they are not used again. The Getting Ready page announces the next story; it
does not link to an unpublished URL. Replace the announcement with the real
story link when that story is ready.

Photographs retain their original proportions and use `object-fit: contain`.
WebP copies are at most 1200 × 1800; full-resolution source files are untouched.
Only the portrait preview has a dedicated 3:4 crop. Text remains HTML.

## Verification

Run `npm run build`, then `npm run test:web-stories` and `npm run test:bunny`.
The story validator checks the **final postprocessed HTML**, AMP validity,
canonical URL, required metadata, logo/poster dimensions, local photographs,
outlinks and the sitemap. It downloads the current official AMP validator.

Use `npm run preview -- --port 4327` to review the completed build. A story may
resume on its last viewed page; append `#page=hamburg-ihr-zwei` to start at the
cover. Check navigation, image loading, text clearance and the last-page CTA
on a small phone, a tall phone and desktop, including Safari/WebKit.

The Bunny and Worker security policies allow the AMP CDN only on standalone
`/web-stories/<slug>/` documents. Regular site, API and admin policies retain
their existing sources. Preview indexing protections remain in force.

A successful local build is not a deployment or evidence of Google indexing.
After a release, verify the public story, its images and security headers,
then check the production URL in Search Console.
Submit `https://artbild-fotografie.de/web-story-sitemap.xml` in Search Console
and request indexing of the story URL using URL Inspection. Submission is not
proof that Google has indexed the story or will display it in Discover.
