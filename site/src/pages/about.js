// The about page.
import { reduce, $$, splitReveal, scrubRise } from '../core.js';

export default function about() {
  splitReveal(document, 0.05);
  if (!reduce) scrubRise($$('.ab-text p, .ab-services dl > div'), { y: 40 });
}
