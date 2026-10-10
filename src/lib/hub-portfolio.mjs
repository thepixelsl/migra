// Web Stories have their own pages and must never become portfolio cards.
export const portfolioPublications = entries => entries.filter(entry =>
  entry.kind === 'gallery' && entry.showInPortfolio !== false && entry.heroImage);
