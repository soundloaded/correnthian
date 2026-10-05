/**
 * Correnthian design tokens.
 *
 * Direction: obsidian surfaces, silver-neutral UI, and a gold accent that is
 * reserved for signalling a metal asset. Gold is never used as general brand
 * colour - if the whole interface is gold, nothing is left to highlight with.
 */
export const color = {
    // Obsidian scale - the neutral substrate
    obsidian: {
        0: '#08090B',
        50: '#0E1013',
        100: '#15181C',
        200: '#1D2126',
        300: '#272C33',
        400: '#363C45',
    },
    // Silver scale - primary UI text and borders
    silver: {
        100: '#E8EAED',
        200: '#C7CBD1',
        300: '#9BA1AA',
        400: '#6E757F',
        500: '#4A5058',
    },
    // Accent - reserved for metals
    gold: {
        accent: '#C9A227',
        soft: '#E3C766',
        muted: '#8A6F1C',
    },
    // Semantic
    positive: '#3FA46A',
    negative: '#D9534F',
    warning: '#D9A441',
    info: '#4A90D9',
    transparent: 'transparent',
};
export const space = {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '24px',
    6: '32px',
    7: '48px',
    8: '64px',
};
export const radius = {
    sm: '8px',
    md: '14px',
    lg: '20px',
    xl: '28px',
    pill: '999px',
};
/**
 * Glass surfaces. Depth without noise - restraint here is what separates
 * this from "glass everywhere", which reads as decoration rather than finance.
 */
export const glass = {
    surface: 'rgba(21, 24, 28, 0.72)',
    surfaceElevated: 'rgba(29, 33, 38, 0.82)',
    border: 'rgba(200, 205, 212, 0.10)',
    borderStrong: 'rgba(200, 205, 212, 0.18)',
    blur: '24px',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
};
export const motion = {
    fast: '140ms',
    base: '240ms',
    slow: '420ms',
    easing: {
        standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
        emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
};
//# sourceMappingURL=index.js.map