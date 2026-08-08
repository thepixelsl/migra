export type MigratedSeoPolicy = {
  indexable: boolean;
  canonicalPath: string;
  robots: string;
  reason?: string;
};

type NoindexRule = {
  canonicalPath?: string;
  reason: string;
};

const INDEX_ROBOTS =
  "follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large";
const NOINDEX_ROBOTS = "noindex, follow";

/**
 * Explicit exceptions for legacy WordPress routes that should remain accessible
 * to visitors, but should not compete in search while their content is thin,
 * obsolete or duplicated elsewhere.
 *
 * A canonical target is only set where the replacement has the same clear
 * search intent. All other routes keep a self canonical; no implicit redirects
 * are introduced here.
 */
export const MIGRATED_NOINDEX_RULES: Readonly<Record<string, NoindexRule>> = {
  // Placeholder galleries with "%" metadata and no standalone editorial copy.
  "/gallery/gallery-getting-ready-2/": {
    reason: "placeholder-gallery",
  },
  "/gallery/getting_ready_block_1/": {
    reason: "placeholder-gallery",
  },
  "/gallery/getting-ready-hamburg-1/": {
    reason: "placeholder-gallery",
  },
  "/gallery/visagistik/": {
    reason: "placeholder-gallery",
  },

  // Very thin legacy stubs without a distinct search purpose.
  "/gallery/engagement-shooting-in-hamburg/": {
    reason: "thin-legacy-gallery",
  },
  "/gallery/gentlemen/": {
    reason: "thin-generic-legacy-gallery",
  },
  "/gallery/jga-hamburg/": {
    reason: "outdated-corona-gallery-teaser",
  },
  "/gallery/paarshooting-in-hamburg/": {
    reason: "thin-competing-legacy-gallery",
  },
  "/hochzeitsfotograf-hochzeit-schessel-hamburg/": {
    reason: "thin-legacy-page",
  },
  "/lbgt-hochzeit-mallorca/": {
    reason: "thin-unverified-service-page",
  },
  "/aktionen-in-adobe-photoshop-cc-importieren/": {
    reason: "thin-legacy-post",
  },
  "/luminanzmasken-photoshop-aktion/": {
    reason: "migrated-navigation-inside-article-content",
  },

  // Utility and campaign landing pages that are not durable search results.
  "/insta-artbild/": {
    reason: "legacy-instagram-landing-page",
  },
  "/instagram-landing/": {
    reason: "legacy-instagram-landing-page",
  },
  "/newsletter/": {
    reason: "legacy-newsletter-landing-page",
  },
  "/sonnenzeiten-hamburg/": {
    reason: "unrendered-wordpress-shortcode",
  },

  // Expired event, pandemic and time-limited campaign information.
  "/regeln-fuer-hochzeitsfeiern-im-sommer-2020-in-hamburg/": {
    reason: "expired-covid-information",
  },
  "/tfp-shooting-hamburg/": {
    reason: "outdated-tfp-and-covid-information",
  },
  "/tfp-shooting-hamburg-2025/": {
    reason: "expired-tfp-campaign",
  },
  "/tfp-shooting-hamburg-instagram/": {
    reason: "legacy-tfp-campaign-landing-page",
  },
  "/tfp-shootings-in-hamburg-und-muenchen/": {
    reason: "expired-tfp-campaign",
  },

  // Superseded or competing versions with an unambiguous primary page.
  "/preisliste/": {
    canonicalPath: "/hochzeitsfotograf-preise/",
    reason: "superseded-pricing-page",
  },
  "/datenschutzerklaerung/": {
    canonicalPath: "/datenschutz/",
    reason: "superseded-privacy-page",
  },
  "/hochzeitsfotograf-geld-sparen/": {
    canonicalPath: "/hochzeitsfotograf-ratgeber/",
    reason: "superseded-thin-guide",
  },

  // Articles whose migrated copy is stale, fact-sensitive or demonstrably
  // search-engine-focused. They stay available for editorial revision.
  "/bildoptimierung-fuer-wordpress-2025/": {
    reason: "dated-technical-guidance",
  },
  "/bildoptimierung-in-wordpress-2025/": {
    reason: "dated-technical-guidance",
  },
  "/fotobox-fuer-die-hochzeit/": {
    reason: "unverified-vendor-recommendation",
  },
  "/guenstig-parken-an-der-elbphilharmonie/": {
    reason: "dated-price-sensitive-guidance",
  },
  "/trauung-im-rathaus-der-hansestadt-hamburg/": {
    reason: "dated-fee-and-availability-information",
  },
  "/vintage-shooting-valentinstag-hamburg/": {
    reason: "keyword-focused-legacy-copy",
  },
  "/wie-sollte-man-hochzeitsfotos-sichern/": {
    reason: "unverified-technical-guidance",
  },
};

export function getMigratedSeoPolicy(path: string): MigratedSeoPolicy {
  const rule = MIGRATED_NOINDEX_RULES[path];

  if (!rule) {
    return {
      indexable: true,
      canonicalPath: path,
      robots: INDEX_ROBOTS,
    };
  }

  return {
    indexable: false,
    canonicalPath: rule.canonicalPath ?? path,
    robots: NOINDEX_ROBOTS,
    reason: rule.reason,
  };
}

export function isMigratedPageIndexable(path: string) {
  return getMigratedSeoPolicy(path).indexable;
}
