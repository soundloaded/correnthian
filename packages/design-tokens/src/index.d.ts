/**
 * Correnthian design tokens.
 *
 * Direction: obsidian surfaces, silver-neutral UI, and a gold accent that is
 * reserved for signalling a metal asset. Gold is never used as general brand
 * colour - if the whole interface is gold, nothing is left to highlight with.
 */
export declare const color: {
    readonly obsidian: {
        readonly 0: "#08090B";
        readonly 50: "#0E1013";
        readonly 100: "#15181C";
        readonly 200: "#1D2126";
        readonly 300: "#272C33";
        readonly 400: "#363C45";
    };
    readonly silver: {
        readonly 100: "#E8EAED";
        readonly 200: "#C7CBD1";
        readonly 300: "#9BA1AA";
        readonly 400: "#6E757F";
        readonly 500: "#4A5058";
    };
    readonly gold: {
        readonly accent: "#C9A227";
        readonly soft: "#E3C766";
        readonly muted: "#8A6F1C";
    };
    readonly positive: "#3FA46A";
    readonly negative: "#D9534F";
    readonly warning: "#D9A441";
    readonly info: "#4A90D9";
    readonly transparent: "transparent";
};
export declare const space: {
    readonly 0: "0";
    readonly 1: "4px";
    readonly 2: "8px";
    readonly 3: "12px";
    readonly 4: "16px";
    readonly 5: "24px";
    readonly 6: "32px";
    readonly 7: "48px";
    readonly 8: "64px";
};
export declare const radius: {
    readonly sm: "8px";
    readonly md: "14px";
    readonly lg: "20px";
    readonly xl: "28px";
    readonly pill: "999px";
};
/**
 * Glass surfaces. Depth without noise - restraint here is what separates
 * this from "glass everywhere", which reads as decoration rather than finance.
 */
export declare const glass: {
    readonly surface: "rgba(21, 24, 28, 0.72)";
    readonly surfaceElevated: "rgba(29, 33, 38, 0.82)";
    readonly border: "rgba(200, 205, 212, 0.10)";
    readonly borderStrong: "rgba(200, 205, 212, 0.18)";
    readonly blur: "24px";
    readonly shadow: "0 8px 32px rgba(0, 0, 0, 0.45)";
};
export declare const motion: {
    readonly fast: "140ms";
    readonly base: "240ms";
    readonly slow: "420ms";
    readonly easing: {
        readonly standard: "cubic-bezier(0.32, 0.72, 0, 1)";
        readonly emphasized: "cubic-bezier(0.16, 1, 0.3, 1)";
    };
};
export type ColorToken = typeof color;
//# sourceMappingURL=index.d.ts.map