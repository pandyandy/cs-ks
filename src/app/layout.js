import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata = {
  title: 'Digitální kulaté stoly',
  description: 'Správa hodnocení zaměstnanců',
  icons: {
    icon: '/ceska_sporitelna_logo.jpg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
