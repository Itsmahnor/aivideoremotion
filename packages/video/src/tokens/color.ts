type Rgb = {red: number; green: number; blue: number};

export const contrastMinimum = 4.5;
export const colorFallbacks = {light: '#FFFFFF', dark: '#000000'} as const;

const hexToRgb = (hex: string): Rgb => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3 ? normalized.split('').map((value) => value.repeat(2)).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) throw new Error(`Expected a hex color, received "${hex}"`);

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
  };
};

const toHex = ({red, green, blue}: Rgb): string =>
  `#${[red, green, blue]
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0'))
    .join('')}`;

const relativeLuminance = (hex: string): number => {
  const {blue, green, red} = hexToRgb(hex);
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
};

export const getContrastRatio = (first: string, second: string): number => {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

export const getReadableTextColor = (background: string, preferred: string): string => {
  if (getContrastRatio(background, preferred) >= contrastMinimum) return preferred;
  const lightContrast = getContrastRatio(background, colorFallbacks.light);
  const darkContrast = getContrastRatio(background, colorFallbacks.dark);
  return lightContrast >= darkContrast ? colorFallbacks.light : colorFallbacks.dark;
};

export const withOpacity = (hex: string, alpha: number): string => {
  const {blue, green, red} = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, alpha))})`;
};

const mix = (hex: string, target: string, amount: number): string => {
  const source = hexToRgb(hex);
  const destination = hexToRgb(target);
  const ratio = Math.min(1, Math.max(0, amount));
  return toHex({
    red: source.red + (destination.red - source.red) * ratio,
    green: source.green + (destination.green - source.green) * ratio,
    blue: source.blue + (destination.blue - source.blue) * ratio,
  });
};

export const lighten = (hex: string, amount: number): string => mix(hex, colorFallbacks.light, amount);
export const darken = (hex: string, amount: number): string => mix(hex, colorFallbacks.dark, amount);
