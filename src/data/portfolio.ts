import type { ImageMetadata } from "astro";

import hochzeitsfotosHamburg from "../assets/portfolio/hochzeitsfotos-hamburg.jpg";
import brautFotoshootingHamburg from "../assets/portfolio/braut-fotoshooting-hamburg.jpg";
import hochzeitsfotografNiedersachsen from "../assets/portfolio/hochzeitsfotograf-niedersachsen.jpg";
import gettingReadyHamburg from "../assets/portfolio/getting-ready-hamburg.jpg";
import steffiDominik from "../assets/portfolio/steffi-dominik.jpg";
import standesamtAltona from "../assets/portfolio/standesamt-altona.jpg";
import paarshootingMallorca from "../assets/portfolio/paarshooting-mallorca.jpg";
import paarshootingHamburg from "../assets/portfolio/paarshooting-hamburg.jpg";
import editorial from "../assets/portfolio/editorial.jpg";
import floralArt from "../assets/portfolio/floral-art.jpg";
import gentlemen from "../assets/portfolio/gentlemen.jpg";
import connyAlex from "../assets/portfolio/conny-alex.jpg";
import barberhouseHamburg from "../assets/portfolio/barberhouse-hamburg.jpg";
import nordenKueste from "../assets/portfolio/norden-kueste.jpg";
import paris from "../assets/portfolio/paris.jpg";
import lovebirdsElbstrand from "../assets/portfolio/lovebirds-elbstrand.jpg";
import traumhochzeitHamburg from "../assets/portfolio/traumhochzeit-hamburg.jpg";
import brautpaarZuerich from "../assets/brautpaar-zuerich/ART_8515-Bearbeitet-scaled.jpg";

export type PortfolioFilter = "All" | "Travel" | "Hochzeit" | "Peoplefotografie";

export type PortfolioEntry = {
  title: string;
  category: string;
  filter: Exclude<PortfolioFilter, "All">;
  date: string;
  href: string;
  image: ImageMetadata;
  alt: string;
  aspect: "square" | "portrait" | "landscape";
};

const entries: PortfolioEntry[] = [
  {
    title: "Brautpaar in Zürich",
    category: "Hochzeit",
    filter: "Hochzeit",
    date: "03.06.2026",
    href: "/brautpaar-in-zuerich/",
    image: brautpaarZuerich,
    alt: "Stephanie und Laurin beim eleganten Styled Elopement Fotoshooting in Zürich",
    aspect: "landscape",
  },
  {
    title: "Hochzeitsfotos Hamburg",
    category: "Hochzeit",
    filter: "Hochzeit",
    date: "15.05.2025",
    href: "/gallery/hochzeitsfotos-hamburg/",
    image: hochzeitsfotosHamburg,
    alt: "Hochzeitsreportage in Hamburg mit elegantem Brautpaar",
    aspect: "square",
  },
  {
    title: "Hochzeit Braut Fotoshooting Hamburg",
    category: "Hochzeit",
    filter: "Hochzeit",
    date: "19.09.2024",
    href: "/gallery/hochzeit-braut-fotoshooting-hamburg/",
    image: brautFotoshootingHamburg,
    alt: "Braut beim Fotoshooting in Hamburg",
    aspect: "portrait",
  },
  {
    title: "Hochzeitsfotograf Niedersachsen",
    category: "Hochzeit",
    filter: "Hochzeit",
    date: "12.08.2021",
    href: "/gallery/hochzeitsfotograf-niedersachsen/",
    image: hochzeitsfotografNiedersachsen,
    alt: "Hochzeitsgesellschaft bei einer Hochzeit in Niedersachsen",
    aspect: "landscape",
  },
  {
    title: "Bilder vom Getting Ready Hamburg mit Leoni Mecklenburg, Ella Deck Couture und Manija Biebow",
    category: "Couples",
    filter: "Hochzeit",
    date: "08.11.2020",
    href: "/gallery/getting-ready-hamburg/",
    image: gettingReadyHamburg,
    alt: "Braut beim Getting Ready vor der Hochzeit in Hamburg",
    aspect: "portrait",
  },
  {
    title: "Steffi & Dominik",
    category: "Couples",
    filter: "Hochzeit",
    date: "20.12.2019",
    href: "/gallery/steffi-dominik/",
    image: steffiDominik,
    alt: "Brautpaar Steffi und Dominik in eleganter Hochzeitsreportage",
    aspect: "portrait",
  },
  {
    title: "Standesamtliche Trauung Standesamt Altona Hochzeitsfotograf Hamburg",
    category: "Couples",
    filter: "Hochzeit",
    date: "04.12.2019",
    href: "/gallery/standesamtliche-trauung-standesamt-altona-hochzeitsfotograf-hamburg/",
    image: standesamtAltona,
    alt: "Standesamtliche Trauung in Hamburg Altona",
    aspect: "landscape",
  },
  {
    title: "Paarshooting Mallorca",
    category: "Couples",
    filter: "Travel",
    date: "24.11.2019",
    href: "/gallery/paarshooting-mallorca/",
    image: paarshootingMallorca,
    alt: "Paarshooting auf Mallorca",
    aspect: "landscape",
  },
  {
    title: "Paarshooting in Hamburg",
    category: "Couples",
    filter: "Hochzeit",
    date: "27.07.2019",
    href: "/gallery/paarshooting-in-hamburg/",
    image: paarshootingHamburg,
    alt: "Paarshooting in Hamburg am Wasser",
    aspect: "landscape",
  },
  {
    title: "Editorial",
    category: "Editorial",
    filter: "Peoplefotografie",
    date: "08.07.2019",
    href: "/gallery/editorial/",
    image: editorial,
    alt: "Editorial Portraitfotografie",
    aspect: "portrait",
  },
  {
    title: "Floral Art",
    category: "Floral Art",
    filter: "Peoplefotografie",
    date: "06.07.2019",
    href: "/gallery/floral-art/",
    image: floralArt,
    alt: "Florales künstlerisches Portrait",
    aspect: "square",
  },
  {
    title: "Gentlemen",
    category: "Gentlemen",
    filter: "Peoplefotografie",
    date: "06.07.2019",
    href: "/gallery/gentlemen/",
    image: gentlemen,
    alt: "Elegantes Herrenportrait",
    aspect: "portrait",
  },
  {
    title: "Conny & Alex",
    category: "Couples",
    filter: "Hochzeit",
    date: "06.07.2019",
    href: "/gallery/engagement-shooting-in-hamburg/",
    image: connyAlex,
    alt: "Paarshooting von Conny und Alex",
    aspect: "landscape",
  },
  {
    title: "Bräutigam im Barberhouse Hamburg",
    category: "Gentlemen",
    filter: "Peoplefotografie",
    date: "06.07.2019",
    href: "/gallery/braeutigam-im-barberhouse-hamburg/",
    image: barberhouseHamburg,
    alt: "Bräutigam beim Styling im Barberhouse Hamburg",
    aspect: "landscape",
  },
  {
    title: "Der Norden und die Küste",
    category: "Norddeutschland",
    filter: "Travel",
    date: "05.07.2019",
    href: "/gallery/der-norden-und-die-kueste/",
    image: nordenKueste,
    alt: "Landschaftsfotografie an der norddeutschen Küste",
    aspect: "landscape",
  },
  {
    title: "Traumhochzeit in Hamburg",
    category: "Hochzeit",
    filter: "Hochzeit",
    date: "05.07.2019",
    href: "/gallery/traumhochzeit-in-hamburg/",
    image: traumhochzeitHamburg,
    alt: "Brautpaar bei einer Hochzeit im Hotel Atlantic Hamburg",
    aspect: "portrait",
  },
  {
    title: "Traumhochzeit in Paris",
    category: "Destination Wedding",
    filter: "Hochzeit",
    date: "05.07.2019",
    href: "/gallery/traumhochzeit-in-paris/",
    image: paris,
    alt: "Braut bei einem editorialen Hochzeitsfotoshooting in Paris",
    aspect: "portrait",
  },
  {
    title: "Lovebirds am Elbstrand",
    category: "Couples",
    filter: "Hochzeit",
    date: "05.07.2019",
    href: "/gallery/lovebirds-am-elbstrand/",
    image: lovebirdsElbstrand,
    alt: "Verlobungsshooting am Elbstrand in Hamburg",
    aspect: "landscape",
  },
];

const preferredFilterOrder: Exclude<PortfolioFilter, "All">[] = [
  "Travel",
  "Hochzeit",
  "Peoplefotografie",
];

const discoveredFilters = new Set(entries.map((entry) => entry.filter));

export const portfolioFilters: PortfolioFilter[] = [
  "All",
  ...preferredFilterOrder.filter((filter) => discoveredFilters.has(filter)),
];

const parseGermanDate = (date: string) => {
  const [day, month, year] = date.split(".").map(Number);
  return Date.UTC(year, month - 1, day);
};

export const portfolioEntries = [...entries].sort(
  (left, right) => parseGermanDate(right.date) - parseGermanDate(left.date),
);

export const portfolioFilterSlug = (filter: PortfolioFilter) =>
  filter === "All"
    ? "all"
    : filter
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
