import { createRoot } from 'react-dom/client';
import { defaultUnsplashConfig } from '@tryghost/admin-x-framework';
import './index.css';
import { AdminAppRoot } from './app-root.tsx';
// SHAPING PROTOTYPE ONLY — never merge (see src/shaping/README.md).
import { loadHelpApp } from './shaping/load-help-app';
import { mountShapingMenu } from './shaping/mount-menu';

const framework = {
  ghostVersion: '',
  unsplashConfig: defaultUnsplashConfig,
};

createRoot(document.getElementById('root')!).render(<AdminAppRoot framework={framework} />);
// SHAPING PROTOTYPE ONLY: the prototype menu, and the Help app a host script would add
mountShapingMenu();
loadHelpApp();
