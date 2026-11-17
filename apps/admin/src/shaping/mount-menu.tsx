import { createRoot } from 'react-dom/client';
import { ShapingMenu } from './menu';

// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
//
// Mounts the prototype menu in its own root, beside Admin's (see menu.tsx).
export const mountShapingMenu = () => {
  const host = document.createElement('div');
  host.setAttribute('data-shaping-menu', '');
  document.body.appendChild(host);
  createRoot(host).render(<ShapingMenu />);
};
