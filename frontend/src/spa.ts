// Using Tailwind CDN so no need to import index.css
// Import consolidated global styles (includes cross-browser, legacy-theme, mobile, tournament)
import './global.css';
import './browser-compatibility.ts';
import './router.ts';
import { bootSpa } from './router.ts';

bootSpa();
