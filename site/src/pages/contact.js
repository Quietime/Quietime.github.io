// The contact page.
import { gsap, reduce, $, $$, CFG, F, splitReveal, copyText, scrubRise } from '../core.js';

/* ── contact: floating labels, inline checks, a sending state ── */
export default function contact() {
  splitReveal(document, 0.05);
  const form = $('[data-form]');
  if (form) {
    const btn = $('[data-send]', form);
    const note = $('[data-note]', form);
    const msg = (el, text) => {
      const m = el.closest('.fld')?.querySelector('[data-msg]');
      if (m) m.textContent = text;
      el.setAttribute('aria-invalid', String(Boolean(text)));
    };
    const reachOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/.test(v) || /^1\d{10}$/.test(v);
    const check = (el) => {
      const v = el.value.trim();
      if (el.required && !v) { msg(el, F.required); return false; }
      if (el.name === 'reach' && v && !reachOk(v)) { msg(el, F.badReach); return false; }
      msg(el, '');
      return true;
    };
    $$('input[required], textarea[required]', form).forEach((el) => {
      el.addEventListener('blur', () => check(el));
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = $$('input[required], textarea[required]', form);
      const ok = fields.map(check).every(Boolean);
      if (!ok) { fields.find((f) => f.getAttribute('aria-invalid') === 'true')?.focus(); return; }
      const d = Object.fromEntries(new FormData(form));
      const B = F.body || {};
      const sep = CFG.lang === 'en' ? ': ' : '：';
      const body = [[B.name, d.name], [B.reach, d.reach], [B.kind, d.kind], [B.date, d.date || B.none], [B.budget, d.budget || B.none]]
        .map(([k, v]) => `${k}${sep}${v || ''}`).join('\n') + `\n\n${d.message}`;
      const subject = `${F.subject}${sep}${d.kind || ''}`;
      btn.classList.add('is-busy'); btn.disabled = true; note.textContent = F.sending;
      try {
        if (CFG.formEndpoint) {
          const r = await fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...d, subject, message: body }) });
          if (!r.ok) throw new Error(String(r.status));
          note.textContent = F.sent;
          form.reset();
        } else {
          await copyText(body);
          location.href = `mailto:${CFG.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          note.textContent = F.mailed;
        }
        btn.classList.add('is-done');
      } catch {
        note.textContent = F.failed;
      } finally {
        btn.classList.remove('is-busy'); btn.disabled = false;
        setTimeout(() => btn.classList.remove('is-done'), 2400);
      }
    });
  }
  // FAQ opens and closes smoothly
  $$('.ct-faq details').forEach((d) => {
    const sum = $('summary', d), body = $('.faq-a', d);
    sum.addEventListener('click', (e) => {
      if (reduce) return;
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'springCrit', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'all' }); } });
      } else {
        d.open = true;
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.55, ease: 'springFirm' });
      }
    });
  });
  if (!reduce) scrubRise($$('.ct-process li, .ct-faq details'), { y: 40 });
}
