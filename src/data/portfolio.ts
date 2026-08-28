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
import travelHamburg from "../assets/travel-galleries/hamburg/ART_4701-HDR-Bearbeitet_web.jpg";
import travelParis from "../assets/travel-galleries/paris/DSC_4967.jpg";
import travelVenedig from "../assets/travel-galleries/venedig/ART_8436-HDR.jpg";
import travelTeneriffa from "../assets/travel-galleries/teneriffa/K1024_Unbenannt-28.jpg";
import paris from "../assets/traumhochzeit-paris-2019/ART_5851_web.jpg";
import lovebirdsElbstrand from "../assets/portfolio/lovebirds-elbstrand.jpg";
import traumhochzeitHamburg from "../assets/portfolio/traumhochzeit-hamburg.jpg";
import elopementFraserSuitesHamburg from "../assets/elopement-fraser-suites-hamburg/ART_5557-Bearbeitet.jpg";
import hochzeitJahrhunderhalleBochum from "../assets/portfolio/hochzeit-jahrhunderhalle-bochum.jpg";
import brautpaarZuerich from "../assets/brautpaar-zuerich/ART_8515-Bearbeitet-scaled.jpg";
import editorialLondon from "../assets/editorial-london/ART_7899-Bearbeitet.jpg";
import parisBridalEditorial from "../assets/paris-bridal-editorial/ART_4765.jpg";
import valerieTim from "../assets/valerie-und-tim/ART_4449.jpg";

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
    title: "Hochzeit von Valerie und Tim",
    category: "Frühlingshochzeit",
    filter: "Hochzeit",
    date: "12.07.2026",
    href: "/gallery/hochzeit-valerie-und-tim/",
    image: valerieTim,
    alt: "Valerie und Tim bei ihrem Brautpaarshooting im Frühlingslicht",
    aspect: "portrait",
  },
  {
    title: "Brautkleid Editorial in Paris",
    category: "Bridal Editorial Paris",
    filter: "Peoplefotografie",
    date: "12.07.2026",
    href: "/gallery/brautkleid-editorial-paris/",
    image: parisBridalEditorial,
    alt: "Brautkleid Editorial in Paris mit Braut und Eiffelturm",
    aspect: "portrait",
  },
  {
    title: "Editorial mit Mariam in London",
    category: "Editorial London",
    filter: "Peoplefotografie",
    date: "12.07.2026",
    href: "/gallery/editorial-london/",
    image: editorialLondon,
    alt: "Editorial Portrait von Mariam an der Themse mit Westminster und Big Ben in London",
    aspect: "portrait",
  },
  {
    title: "Hochzeit Jahrhunderthalle Bochum",
    category: "Hochzeit",
    filter: "Hochzeit",
    date: "04.07.2026",
    href: "/gallery/hochzeit-jahrhunderhalle-bochum/",
    image: hochzeitJahrhunderhalleBochum,
    alt: "Hochzeitsgesellschaft vor der Industriearchitektur der Jahrhunderthalle Bochum",
    aspect: "portrait",
  },
  {
    title: "Brautpaar-Editorial Fraser Suites Hamburg",
    category: "Styled Editorial",
    filter: "Peoplefotografie",
    date: "04.07.2026",
    href: "/gallery/elopement-hochzeit-fraser-suites-hamburg/",
    image: elopementFraserSuitesHamburg,
    alt: "Brautpaar beim Editorial in den Fraser Suites Hamburg",
    aspect: "landscape",
  },
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
    filter: "Hochzeit",
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
    title: "Landschaftsbilder und Portraits von der Stadt Hamburg",
    category: "Hamburg",
    filter: "Travel",
    date: "05.07.2019",
    href: "/gallery/hamburg/",
    image: travelHamburg,
    alt: "Hamburger Stadtlandschaft am Wasser im warmen Abendlicht",
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
    title: "Cityscapes aus Paris",
    category: "Paris",
    filter: "Travel",
    date: "05.07.2019",
    href: "/gallery/paris/",
    image: travelParis,
    alt: "Travel Fotografie und Cityscape aus Paris",
    aspect: "landscape",
  },
  {
    title: "Cityscapes aus Venedig",
    category: "Venedig und Murano",
    filter: "Travel",
    date: "05.07.2019",
    href: "/gallery/venedig/",
    image: travelVenedig,
    alt: "Travel Fotografie aus Venedig und Murano",
    aspect: "landscape",
  },
  {
    title: "Landschaftsbilder aus Teneriffa",
    category: "Kanarische Inseln",
    filter: "Travel",
    date: "01.12.2017",
    href: "/gallery/teneriffa/",
    image: travelTeneriffa,
    alt: "Travel Fotografie auf Teneriffa mit Landschaft und Lichtstimmung",
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
    alt: "Editoriales Brautbild in einer Pariser Straße",
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
