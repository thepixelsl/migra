export type StoryPhoto = { src: string; alt: string; width: number; height: number };
export type StoryPage = {
  id: string;
  kicker: string;
  heading: string;
  text: string;
  photos: StoryPhoto[];
  layout?: "cover" | "diptych" | "closing";
  cta?: { label: string; href: string };
};

const base = "/images/web-stories/paarshooting-hamburg-september-2026/";
const photo = (name: string, alt: string, width = 1200, height = 1800): StoryPhoto => ({
  src: `${base}${name}.webp`, alt, width, height,
});

export const hamburgCoupleStory = {
  slug: "paarshooting-hamburg-september-2026",
  title: "Paarshooting in Hamburg – aus der Schweiz an die Elbe",
  description: "Ein Paar aus der Schweiz entdeckt Hamburg beim Paarshooting: Septemberlicht an der Stadthausbrücke und gemeinsame Momente am Brunnen im Rathausinnenhof.",
  poster: `${base}poster-portrait.webp`,
  pages: [
    {
      id: "hamburg-ihr-zwei", layout: "cover", kicker: "Aus der Schweiz an die Elbe",
      heading: "Paarshooting\nin Hamburg.",
      text: "Ein Paar. Eine Reise. Erinnerungen zu zweit.",
      photos: [photo("01-stadthausbruecke", "Das Paar am Fleet nahe der Stadthausbrücke in Hamburg", 1200, 1500)],
    },
    {
      id: "aus-der-schweiz", kicker: "September 2026",
      heading: "Eine Reise.\nZeit für euch.",
      text: "Extra aus der Schweiz angereist: Die beiden verbinden ihre Zeit in Hamburg mit einem Paarshooting.",
      photos: [photo("02-am-fleet", "Das Paar lächelt auf einer Brücke über das Hamburger Fleet")],
    },
    {
      id: "hamburger-licht", kicker: "Rund um die Stadthausbrücke",
      heading: "Die Stadt.\nUnd dieses Licht.",
      text: "Helle Fassaden, Brücken und Licht auf dem Wasser. Mitten in Hamburg finden wir Platz für einen Moment zu zweit.",
      photos: [photo("03-septemberlicht", "Das Paar schaut sich im Septemberlicht auf der Brücke an")],
    },
    {
      id: "einzelportraets", layout: "diptych", kicker: "Paarshooting mit Persönlichkeit",
      heading: "Zusammen.\nUnd jeder für sich.",
      text: "Zu eurem Paarshooting gehören auf Wunsch auch Einzelporträts. Für euren Ausdruck und euren ganz eigenen Stil.",
      photos: [
        photo("04-sein-portraet", "Einzelporträt des Mannes beim Gehen vor einer hellen Hamburger Fassade", 1200, 1500),
        photo("05-ihr-portraet", "Nahes Porträt der Frau im silberfarbenen Kleid neben ihrem Partner"),
      ],
    },
    {
      id: "hamburger-architektur", kicker: "Hamburg als Kulisse",
      heading: "Backstein. Licht.\nGanz viel Nähe.",
      text: "Ein paar Schritte weiter verändert sich die Kulisse. Backstein und klare Linien geben euren Bildern einen anderen Charakter.",
      photos: [photo("06-backstein", "Das Paar steht eng beieinander zwischen Backsteinpfeilern und hellen Arkaden")],
    },
    {
      id: "kleine-gesten", kicker: "Was eure Bilder persönlich macht",
      heading: "Die kleinen\nGesten bleiben.",
      text: "Eine Hand auf seiner Schulter. Ein Blick nach unten. Beim Fotografieren achte ich auch auf das, was ganz nebenbei passiert.",
      photos: [photo("07-kleine-gesten", "Sie berührt die goldene Stickerei auf seiner Weste")],
    },
    {
      id: "rathausinnenhof", kicker: "Im Innenhof des Hamburger Rathauses",
      heading: "Ein Brunnen.\nEin Lächeln.",
      text: "Am Brunnen treffen Wasser und prächtige Architektur aufeinander. Eine wunderschöne Kulisse für eure Paarfotos in Hamburg.",
      photos: [photo("08-rathausbrunnen", "Das Paar lächelt sich vor dem Brunnen im Hamburger Rathausinnenhof an", 1200, 1500)],
    },
    {
      id: "historische-kulisse", kicker: "Hamburgs elegante Seite",
      heading: "Eine Stadt\nmit Charakter.",
      text: "Geschnitzte Türen und alte Fassaden geben dem Shooting Tiefe. Wir nutzen die Architektur und lassen euch im Mittelpunkt.",
      photos: [photo("09-historische-tuer", "Das Paar vor einer reich verzierten dunklen Holztür in Hamburg")],
    },
    {
      id: "euer-moment", kicker: "Paarfotografie von Artbild",
      heading: "Ein Moment,\nder euch gehört.",
      text: "Ich begleite euch mit einem Blick für Licht, Bildaufbau und eure Verbindung. So entstehen gemeinsame Erinnerungen an Hamburg.",
      photos: [photo("10-am-brunnen", "Nahes Paarporträt vor dem Brunnen und den Bögen des Hamburger Rathauses", 1200, 1800)],
    },
    {
      id: "euer-paarshooting", kicker: "Eure Zeit vor der Kamera",
      heading: "So, wie\nihr euch mögt.",
      text: "Festlich wie die beiden oder ganz entspannt: Wir stimmen Orte und Bildstil auf euch ab. Für euer Paarshooting in Hamburg.",
      photos: [photo("11-hamburger-fassaden", "Das Paar in einer Umarmung vor hellen Hamburger Stadthäusern")],
    },
    {
      id: "getting-ready-ausblick", kicker: "Als Nächstes · dieselben zwei",
      heading: "Getting Ready\nim Le Méridien.",
      text: "Die nächste Story führt zurück zum Anfang: zum Getting Ready der beiden im Le Méridien Hamburg. Demnächst hier.",
      photos: [photo("12-ausblick", "Das Paar auf der Brücke am Fleet, sie wendet sich ihm zu")],
    },
    {
      id: "paarshooting-anfragen", layout: "closing", kicker: "Euer Paarshooting in Hamburg",
      heading: "Hamburg.\nIhr zwei.",
      text: "Plant ihr eine Reise oder seid ihr hier zu Hause? Erzählt mir von euch und euren Wünschen für gemeinsame Bilder.",
      photos: [photo("13-eure-erinnerungen", "Das Paar auf einer Hamburger Brücke mit dem Fleet im Hintergrund")],
      cta: { label: "Paarshooting anfragen", href: "/kontakt/?anliegen=paarshooting&quelle=web-story-hamburg" },
    },
  ] satisfies StoryPage[],
};
