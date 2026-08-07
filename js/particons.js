// VALCORSA — product icons for the parts store. Solid single-color SVG marks,
// picked by part.kind first (atomic engine stack), then family. currentColor fills
// so CSS decides the ink. window.PART_ICON(part) → svg string.
'use strict';

window.PART_ICON = (() => {
  const svg = d => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg>`;
  const I = {
    // atomic engine stack
    block:   svg('<path d="M3 8h18v11H3zM6 5h12v3H6z"/><circle cx="7.5" cy="13.5" r="1.7" fill="#fff" opacity=".85"/><circle cx="12" cy="13.5" r="1.7" fill="#fff" opacity=".85"/><circle cx="16.5" cy="13.5" r="1.7" fill="#fff" opacity=".85"/>'),
    crank:   svg('<path d="M2 11h4v2H2zM18 11h4v2h-4zM6 8h3v8H6zM15 8h3v8h-3zM9 8h6v3H9zM9 13h6v3H9z" opacity=".95"/><circle cx="7.5" cy="12" r="1.1" fill="#fff" opacity=".8"/><circle cx="16.5" cy="12" r="1.1" fill="#fff" opacity=".8"/>'),
    pistons: svg('<path d="M7 3h10v7H7z"/><path d="M10 10h4v5h-4z"/><circle cx="12" cy="17.5" r="3"/><circle cx="12" cy="17.5" r="1.2" fill="#fff" opacity=".85"/>'),
    cam:     svg('<path d="M2 11h20v2H2z"/><ellipse cx="7" cy="12" rx="2.2" ry="3.6"/><ellipse cx="13" cy="12" rx="2.2" ry="3.6" transform="rotate(28 13 12)"/><ellipse cx="19" cy="12" rx="2.2" ry="3.6" transform="rotate(-24 19 12)"/>'),
    head:    svg('<path d="M3 14h18v5H3z"/><path d="M3 6h18v2H3zM3 9.5h18v2H3z" opacity=".8"/><circle cx="7" cy="16.5" r="1" fill="#fff" opacity=".8"/><circle cx="12" cy="16.5" r="1" fill="#fff" opacity=".8"/><circle cx="17" cy="16.5" r="1" fill="#fff" opacity=".8"/>'),
    turbo:   svg('<circle cx="10" cy="12" r="7"/><circle cx="10" cy="12" r="3.2" fill="#fff" opacity=".85"/><path d="M15.5 7.5 22 6l-3.4 4.6zM10 19h9v2.6h-9z"/>'),
    bolts:   svg('<path d="M8.2 2.5h7.6l3.8 6.6-3.8 6.6H8.2L4.4 9.1z"/><circle cx="12" cy="9.1" r="2.6" fill="#fff" opacity=".85"/><path d="M10.5 17h3v5h-3z"/>'),
    gasket:  svg('<path fill-rule="evenodd" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 4.4a4.6 4.6 0 110 9.2 4.6 4.6 0 010-9.2z"/><circle cx="12" cy="4.6" r="1" fill="#fff" opacity=".8"/><circle cx="12" cy="19.4" r="1" fill="#fff" opacity=".8"/><circle cx="4.6" cy="12" r="1" fill="#fff" opacity=".8"/><circle cx="19.4" cy="12" r="1" fill="#fff" opacity=".8"/>'),
    // families
    Engine:  svg('<path d="M4 9h14v9H4zM7 6h8v3H7zM18 11h3v5h-3zM2 11h2v5H2z"/>'),
    Tires:   svg('<path fill-rule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 5.4a4.6 4.6 0 110 9.2 4.6 4.6 0 010-9.2z"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2.4"/>'),
    Gearbox: svg('<path fill-rule="evenodd" d="M12 4l1.8 2.5 3-.6 1 2.9 3 .8-.7 3 2 2.3-2 2.3.7 3-3 .8-1 2.9-3-.6L12 25l-1.8-2.7-3 .6-1-2.9-3-.8.7-3-2-2.3 2-2.3-.7-3 3-.8 1-2.9 3 .6z" transform="translate(0 -2.5)"/><circle cx="12" cy="12" r="3.4" fill="#fff" opacity=".85"/>'),
    Brakes:  svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="#fff" opacity=".85"/><path d="M17 3.5A9.5 9.5 0 0122 12h-3a7 7 0 00-3.6-6z" fill="#fff" opacity=".55"/>'),
    Aero:    svg('<path d="M2 8c8-3.5 15-3.5 20-1l-2 4C15 9 8.5 9.5 4 12z"/><path d="M5 13h2.6v6H5zM17 10h2.6v9H17z"/>'),
    Electrical: svg('<path d="M13.5 2 5 13.5h5L9.5 22 19 9.5h-5.5z"/>'),
    Fluid:   svg('<path d="M12 2s6.5 7.5 6.5 12.3A6.5 6.5 0 0112 21a6.5 6.5 0 01-6.5-6.7C5.5 9.5 12 2 12 2z"/>'),
    Chassis: svg('<path d="M3 13c2-1 3-4 6-4h6c3 0 4 3 6 4v4h-2.2a2.6 2.6 0 01-5.2 0H8.4a2.6 2.6 0 01-5.2 0H2z"/><circle cx="5.8" cy="17" r="1.6" fill="#fff" opacity=".85"/><circle cx="18.2" cy="17" r="1.6" fill="#fff" opacity=".85"/>'),
    Consumables: svg('<path d="M4 8h16v12H4z"/><path d="M9 8V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V8h-2V6h-2v2z"/><path d="M4 12h16v2H4z" fill="#fff" opacity=".55"/>'),
    Silly:   svg('<path d="M12 2l2.5 6.6L21 9.3l-5 4.4 1.6 6.8L12 16.8l-5.6 3.7L8 13.7 3 9.3l6.5-.7z"/>'),
  };
  return p => I[p.kind] || I[p.fam] || I.Consumables;
})();
