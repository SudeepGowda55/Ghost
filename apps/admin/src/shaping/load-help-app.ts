// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
//
// On Ghost(Pro), the host script (pro.js) adds the Help app's loader to Admin.
// A local Ghost has no host script, so the prototype adds the same loader
// itself: the real Help app, from production, opens in the side panel. The
// app allows a local Ghost to frame it. Help links still need the "In-app
// support" flag on in Labs, as they do on Ghost(Pro).

const LOADER_URL = 'https://sup.ghost.org/loader.js';

export const loadHelpApp = () => {
  if (document.querySelector(`script[src="${LOADER_URL}"]`)) {
    return;
  }
  // A classic script: the loader reads its own address from currentScript
  const script = document.createElement('script');
  script.src = LOADER_URL;
  document.head.appendChild(script);
};
