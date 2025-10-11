const seriesTitleSelectors = [
  ".page-title",
  "h1.title",
  "h1",
  ".entry-title",
  ".titulo",
  ".title",
  "header h1",
];

const seasonTitleSelectors = [
  ".season-title",
  "h2.title",
  "h2",
  ".entry-title",
  ".titulo",
  ".title",
  "header h2",
];

/**
 * Locate a human readable series title for a given hyperlink identifier.
 * @param {string} seriesId Anchor identifier or URL fragment associated with the series.
 * @returns {string} Series title if found, otherwise falls back to `Unknown Series`.
 */
export function getSeriesNameForId(seriesId) {
  if (typeof seriesId !== "string") {
    return "Unknown Series";
  }
  const link = document.querySelector(`a[href^='${seriesId}']`);
  if (link?.textContent) {
    return link.textContent.trim();
  }
  const header = document.querySelector(seriesTitleSelectors.join(", "));
  if (header?.textContent) {
    return header.textContent.trim();
  }
  return "Unknown Series";
}

/**
 * Locate a human readable season title for a given hyperlink identifier.
 * @param {string} seasonId Anchor identifier or URL fragment associated with the season.
 * @returns {string} Season title if found, otherwise falls back to `Unknown Season`.
 */
export function getSeasonNameForId(seasonId) {
  if (typeof seasonId !== "string") {
    return "Unknown Season";
  }
  const link = document.querySelector(`a[href^='${seasonId}']`);
  if (link?.textContent) {
    return link.textContent.trim();
  }
  const header = document.querySelector(seasonTitleSelectors.join(", "));
  if (header?.textContent) {
    return header.textContent.trim();
  }
  return "Unknown Season";
}

/**
 * Extract the first matching series title from the provided DOM subtree.
 * @param {ParentNode} root DOM node used as the search root for title selectors.
 * @returns {string|null} Series title when located, or `null` if no selector matches.
 */
export function getSeriesTitleFromElement(root) {
  for (const selector of seriesTitleSelectors) {
    const text = root.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }
  return null;
}

/**
 * Extract the first matching season title from the provided DOM subtree.
 * @param {ParentNode} root DOM node used as the search root for title selectors.
 * @returns {string|null} Season title when located, or `null` if no selector matches.
 */
export function getSeasonTitleFromElement(root) {
  for (const selector of seasonTitleSelectors) {
    const text = root.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }
  return null;
}
