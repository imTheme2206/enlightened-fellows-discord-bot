/** Normalises Kira Greek letters / quotes in upstream names (shared by all scrape entities). */
export const deKira = (name: string): string =>
  name
    .replace(/α/g, 'Alpha')
    .replace(/β/g, 'Beta')
    .replace(/γ/g, 'Gamma')
    .replace(/"/g, "'")
    .replace(/G\. /g, 'G ')
