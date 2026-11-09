import records from './posing-guide-cards.json';

export const guidePath = '/posing-guide/';
export const guideChapters = [
  { slug: 'posen-frauen', label: 'Frauen', title: 'Posen für Frauen', count: 10, first: 6, last: 15, imageId: '008',
    description: '10 gezeichnete Posen für Frauen: stehen, gehen und sitzen. Beschreibungen zu Haltung, Händen und Kameraposition für dein Fotoshooting.',
    intro: 'Du stehst mit verlagertem Gewicht, sitzt auf einem Stuhl oder bewegst dich langsam auf die Kamera zu. Die Zeichnungen zeigen, wie Beine, Hände und Blick zusammenwirken – in einem Kleid ebenso wie in deiner eigenen Lieblingskleidung.' },
  { slug: 'posen-maenner', label: 'Männer', title: 'Posen für Männer', count: 10, first: 16, last: 25, imageId: '016',
    description: '10 gezeichnete Posen für Männer: stehen, sitzen und gehen. Mit lockeren Händen, kleinen Bewegungen und Orientierung zur Kamera beim Fotoshooting.',
    intro: 'Eine Hand liegt in der Tasche, die Schulter lehnt an einer Wand oder du richtest deine Manschette. Diese kleinen Handlungen geben deiner Haltung einen natürlichen Ausgangspunkt – draußen, im Hotel und in privaten Räumen.' },
  { slug: 'hochzeitsposen', label: 'Paare & Hochzeit', title: 'Posen für Paare und Hochzeitsfotos', count: 20, first: 26, last: 45, imageId: '026',
    description: '20 illustrierte Paar- und Hochzeitsmotive: gemeinsam gehen, Nähe, Tanz und spielerische Posen. Mit Beschreibungen für euch vor der Kamera.',
    intro: 'Ihr geht Hand in Hand, sitzt nebeneinander oder seid euch ganz nah. Die 20 Karten zeigen Paar- und Hochzeitsmotive mit ruhigen und bewegten Varianten. Einige zeigen dieselbe Situation aus einer anderen Kameraperspektive.' },
  { slug: 'grundlagen', label: 'Grundlagen', title: 'Haltung und Kameraperspektive', count: 5, first: 1, last: 5, imageId: '001',
    description: 'Fünf illustrierte Posing-Grundlagen: entspannter Stand, Kopfhaltung und Kameraperspektive. Eine Orientierung für deinen Moment vor der Kamera.',
    intro: 'Deine Füße geben dir Halt, dein Oberkörper ist aufgerichtet und deine Schultern bleiben locker. Kleine Veränderungen von Kopf und Blick wirken je nach Kameraposition anders. Die Zeichnungen machen diese Unterschiede sichtbar.' },
] as const;

export const guideCards = guideChapters.flatMap(chapter => records
  .filter(card => Number(card.id) >= chapter.first && Number(card.id) <= chapter.last)
  .map((card, index) => ({ ...card, chapter: chapter.slug, group: chapter.label, number: index + 1, count: chapter.count }))
).map((card, index) => ({ ...card, page: index + 4 }));
export type GuideCard = (typeof guideCards)[number];
export const totalPages = guideCards.length + 3;
export const coverCard = guideCards.find(card => card.id === '026')!;
export const guidePageIds = ['titel', 'inhalt', 'orientierung', ...guideCards.map(card => `pose-${card.id}`)];
