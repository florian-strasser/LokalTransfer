// Builds the favicon SVG (the three-circle mark) in a single colour.
//
// The colour is an inline `fill` presentation attribute rather than
// `currentColor` or a `<style>` block: a favicon has no inheriting context, and
// Safari ignores `prefers-color-scheme` inside an SVG favicon. One colour is
// therefore used for both light and dark tabs — a dark-specific variant only
// ever broke the other theme.
//
// The viewBox is padded to a square: the mark is 401 × 261, so 70 units of
// headroom above and below centre it in a 401 × 401 box. Favicons are rendered
// into square slots, and without this the mark would sit off-centre.
export function buildFaviconSvg(
  fill: string,
  backOpacity = 0.33,
  midOpacity = 0.66
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -70 401 401">
  <path fill="${fill}" fill-opacity="${backOpacity}" d="M63.897,178.539C59.485,179.816 54.821,180.5 50,180.5C22.404,180.5 0,158.095 0,130.5C0,102.904 22.404,80.5 50,80.5C54.821,80.5 59.485,81.183 63.897,82.46C55.096,96.364 50,112.841 50,130.5C50,148.158 55.096,164.635 63.897,178.539Z"/>
  <path fill="${fill}" fill-opacity="${midOpacity}" d="M171.068,214.985C161.383,218.552 150.917,220.5 140,220.5C90.328,220.5 50,180.173 50,130.5C50,80.828 90.328,40.5 140,40.5C150.917,40.5 161.383,42.449 171.068,46.016C151.696,68.788 140,98.289 140,130.5C140,162.711 151.696,192.213 171.068,214.985Z"/>
  <circle fill="${fill}" cx="270.5" cy="130.5" r="130.5"/>
</svg>`
}
