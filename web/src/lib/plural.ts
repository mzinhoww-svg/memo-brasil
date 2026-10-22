/** Escolhe singular (n === 1) ou plural. Zero e os demais usam o plural, como no português do Brasil. */
export const plural = (n: number, singular: string, plural: string): string => (n === 1 ? singular : plural);
