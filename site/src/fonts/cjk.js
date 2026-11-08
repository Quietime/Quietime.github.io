// Chinese type. Loaded as a separate stylesheet so its few hundred @font-face rules (one per unicode-range
// slice) do not hold up the first paint; text shows in the system face and swaps when a slice arrives.
// Every language needs it: the English and Japanese pages carry the studio's Chinese name and series titles.
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-sans-sc/400.css';
import '@chinese-fonts/dyh/dist/SmileySans-Oblique/result.css';
