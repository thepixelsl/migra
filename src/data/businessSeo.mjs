import { homepageSeo } from "./homepageSeo.mjs";

// Verified 2026-09-03: the Google Maps listing links back to this website and
// matches the street address. Coordinates are the listing's business pin, not
// the map viewport or the centre of Hamburg. See docs/structured-data.md.
export const businessIdentity = {
  name: "Artbild-Fotografie",
  personName: "York Augustin",
  email: "info@artbild-fotografie.de",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rahlstedter Bahnhofstraße 27",
    postalCode: "22143",
    addressLocality: "Hamburg",
    addressRegion: "Hamburg",
    addressCountry: "DE",
  },
  geo: { "@type": "GeoCoordinates", latitude: 53.6035183, longitude: 10.155377 },
  mapsUrl: "https://www.google.com/maps?cid=3631123687202652958",
  profiles: [
    "https://www.instagram.com/artbild/",
    "https://www.facebook.com/artbildfotografie/",
    "https://www.pinterest.de/artbildf/",
  ],
};

export function entityIds(origin) {
  return {
    business: `${origin}/#organization`,
    person: `${origin}/#person-york-augustin`,
    website: `${origin}/#website`,
  };
}

export function createIdentityGraph(origin, { homepageImage, portraitImage }) {
  const ids = entityIds(origin);
  const ref = (id) => ({ "@id": id });
  return [
    {
      "@type": "LocalBusiness", "@id": ids.business,
      name: businessIdentity.name, url: `${origin}/`,
      description: homepageSeo.description,
      email: businessIdentity.email,
      address: { ...businessIdentity.address }, geo: { ...businessIdentity.geo },
      hasMap: businessIdentity.mapsUrl,
      sameAs: [...businessIdentity.profiles, businessIdentity.mapsUrl],
      logo: `${origin}/images/logo-artbild-black.png`,
      image: ref(homepageImage["@id"]), founder: ref(ids.person),
      areaServed: [
        { "@type": "City", name: "Hamburg" },
        { "@type": "AdministrativeArea", name: "Norddeutschland" },
        { "@type": "Country", name: "Deutschland" },
        { "@type": "Place", name: "Mallorca" },
      ],
      contactPoint: {
        "@type": "ContactPoint", contactType: "Kundenanfragen",
        email: businessIdentity.email, url: `${origin}/kontakt/`,
        availableLanguage: "de",
      },
      hasOfferCatalog: [
        ref(`${origin}/#hochzeitsfotografie-leistungen`),
        ref(`${origin}/hochzeitsfotograf-preise/#pakete`),
      ],
      // No telephone: preserve the existing click-to-reveal protection.
      // No invented opening hours, price range, ratings, awards or founding date.
    },
    {
      "@type": "Person", "@id": ids.person,
      name: businessIdentity.personName, url: `${origin}/about/`,
      jobTitle: "Hochzeitsfotograf", image: portraitImage,
      worksFor: ref(ids.business),
      mainEntityOfPage: ref(`${origin}/about/#webpage`),
      knowsAbout: ["Hochzeitsfotografie", "Hochzeitsreportage", "Standesamtfotografie", "Paarshooting"],
      homeLocation: { "@type": "City", name: "Hamburg" },
      sameAs: [...businessIdentity.profiles],
    },
    {
      "@type": "WebSite", "@id": ids.website,
      name: businessIdentity.name, url: `${origin}/`,
      publisher: ref(ids.business), inLanguage: "de-DE",
    },
  ];
}

export function photoCredits(origin) {
  // York confirmed on 2026-09-03 that he is also the photographer and rights
  // holder of his portrait. These links describe reserved rights, not a grant.
  return {
    creator: { "@id": entityIds(origin).person },
    creditText: `${businessIdentity.personName} / ${businessIdentity.name}`,
    copyrightNotice: `© ${businessIdentity.personName}. Alle Rechte vorbehalten.`,
    license: `${origin}/impressum/#copyright-title`,
    acquireLicensePage: `${origin}/kontakt/`,
  };
}
