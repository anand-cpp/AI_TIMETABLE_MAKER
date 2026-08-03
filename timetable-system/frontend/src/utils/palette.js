export const PALETTES = [
  // Palette A (Sage)
  {
    light: { bg: '#E4EDE7', text: '#4A7C59', border: '#C2D9C8' },
    dark: { bg: '#1F2620', text: '#A8C089', border: '#2D3A2F' },
  },
  // Palette B (Terracotta)
  {
    light: { bg: '#F3E1D6', text: '#B85C38', border: '#E8C5B3' },
    dark: { bg: '#2A1E17', text: '#D69078', border: '#3E2A20' },
  },
  // Palette C (Ochre)
  {
    light: { bg: '#F5E8CE', text: '#A67C2E', border: '#E9D2A3' },
    dark: { bg: '#2A2318', text: '#D4B47A', border: '#3E3320' },
  },
  // Palette D (Dusty Blue)
  {
    light: { bg: '#DEE5EC', text: '#4A6FA5', border: '#C0D0E0' },
    dark: { bg: '#1B2028', text: '#8AA0BC', border: '#283240' },
  },
  // Palette E (Mauve)
  {
    light: { bg: '#EBE0E5', text: '#8B5A6E', border: '#D9C5CF' },
    dark: { bg: '#241C20', text: '#B58FA0', border: '#3A2A32' },
  },
  // Palette F (Forest)
  {
    light: { bg: '#DDE6D9', text: '#3E5641', border: '#BFCFBB' },
    dark: { bg: '#1B221E', text: '#94B08C', border: '#28342C' },
  },
  // Palette G (Sand)
  {
    light: { bg: '#EFE7D6', text: '#8B7048', border: '#DFCFA9' },
    dark: { bg: '#241F16', text: '#C2A87A', border: '#382F20' },
  },
  // Palette H (Slate)
  {
    light: { bg: '#E0E1DC', text: '#556170', border: '#C6C8BF' },
    dark: { bg: '#1E1F1C', text: '#9AA1AA', border: '#2D302A' },
  },
];

/**
 * Returns theme inline styles for an item based on index or string key
 */
export function getPaletteForIndex(index = 0, isDark = false) {
  let num = 0;
  if (typeof index === 'number') {
    num = index;
  } else if (typeof index === 'string') {
    num = index.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  }
  const palette = PALETTES[Math.abs(num) % PALETTES.length];
  const colorSet = isDark ? palette.dark : palette.light;

  return {
    backgroundColor: colorSet.bg,
    color: colorSet.text,
    borderColor: colorSet.border,
  };
}
