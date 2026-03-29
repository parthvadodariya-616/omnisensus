// src/app/layout.js
import './theme-reference.css';
import './globals.css';
import '../styles/common.css';
import '../styles/vars-alias.css';   // ← fixes all --grey-* and --dark aliases
import '../styles/components.css';
import '../styles/compat.css';
import '../styles/style.css';
import '../styles/dashboard.css';
import '../styles/admin.css';
import '../styles/doctor.css';
import '../styles/patient.css';
import '../styles/auth.css';
import '../styles/index.css';
import '../styles/final-polish.css';

export const metadata = {
  title: 'OmniSensus Medical · Clinical Intelligence',
  description: 'AI-powered clinical decision support and integrated health intelligence platform',
};

import PageTransition from '../components/PageTransition';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * {
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
          }
        `}</style>
        <script dangerouslySetInnerHTML={{__html:`
          document.addEventListener('contextmenu', e => e.preventDefault());
          document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) || (e.key === 'F12')) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          });
        `}} />
      </head>
      <body>
        <PageTransition>
          {children}
        </PageTransition>
      </body>
    </html>
  );
}