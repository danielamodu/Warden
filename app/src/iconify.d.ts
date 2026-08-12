// Type declaration for the <iconify-icon> web component (loaded via CDN
// script in index.html, same as every Superdesign draft). Declared as a
// custom element so JSX accepts the literal `class`/`icon` attributes exactly
// as they appear in the original drafts.
import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        icon?: string;
        class?: string;
      };
    }
  }
}

export {};
