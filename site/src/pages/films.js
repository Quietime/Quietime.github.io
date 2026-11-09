// The films page.
import { splitReveal } from '../core.js';
import films from '../parts/player.js';

export default function filmsPage() {
  splitReveal(document, 0.05);
  films();
}
