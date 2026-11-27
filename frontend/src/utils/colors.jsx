export function getContrastColor(hex) {
    const rgb = [1, 3, 5].map(i => {
        const value = parseInt(hex.slice(i, i + 2), 16) / 255;

        // converts the color into a single linear value
        return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
    });

    // calculates luminance based on the RGB values
    // then decides wheter to use black or white color
    // which is later used to display text on different
    // colored backgrounds
    const luminance =
        0.2126 * rgb[0] +
        0.7152 * rgb[1] +
        0.0722 * rgb[2];

    return luminance > 0.179 ? "#000000" : "#ffffff";
}
