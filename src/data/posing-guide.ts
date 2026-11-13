import content from './posing-guide.json';

export const guidePath = '/posing-guide/';
export const guideContent = content;
export const guidePage = content.page;
export const guideCover = content.cover;

// Array order is editorial. Public IDs remain unchanged when pages move.
export const guideChapters = content.chapters.map(chapter => ({ ...chapter, count: chapter.cards.length }));
export const guideCards = guideChapters.flatMap(chapter => chapter.cards.map((card, index) => ({
  ...card, chapter: chapter.slug, group: chapter.label, number: index + 1, count: chapter.cards.length,
}))).map((card, index) => ({ ...card, page: index + 2 }));
export type GuideCard = (typeof guideCards)[number];
export const totalPages = guideCards.length + 1;
export const coverCard = guideCards.find(card => card.id === guideCover.imageCardId)!;
if (!coverCard) throw new Error('The posing guide cover must refer to an existing card.');
export const guidePageIds = ['titel', ...guideCards.map(card => `pose-${card.id}`)];
