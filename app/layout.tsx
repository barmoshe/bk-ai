import type { Metadata } from 'next';
import { Atkinson_Hyperlegible, Inter, Lora, Nunito, M_PLUS_Rounded_1c, Fredoka } from 'next/font/google';
import './globals.css';
import { ToastProvider } from './components/ui/Toast';

const atkinson = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-body-var' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-heading-var' });
const lora = Lora({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-lora' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-nunito' });
const mplus = M_PLUS_Rounded_1c({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mplus-rounded' });
const fredoka = Fredoka({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-fredoka' });

export const metadata: Metadata = {
  title: 'AI Book Creator',
  description: "Create beautiful children's books with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={[atkinson.variable, inter.variable, lora.variable, nunito.variable, mplus.variable, fredoka.variable, atkinson.className].join(' ')}>
        <ToastProvider>
          <div className='min-h-screen'>
            <nav className='sticky top-0 z-40 border-b border-purple-100 bg-white/80 backdrop-blur-sm'>
              <div className='mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8'>
                <div className='flex items-center justify-between'>
                  <a href='/' className='bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent hover:opacity-80 transition-opacity'>
                    ✨ AI Book Creator
                  </a>
                  <div className='flex items-center gap-3'>
                    <a href='/books' className='btn-secondary text-sm'>
                      📚 My Books
                    </a>
                    <a href='/progress' className='btn-ghost text-sm'>
                      📊 Progress
                    </a>
                    <a href='/prefs' className='btn-ghost text-sm'>
                      ⚙️ Prefs
                    </a>
                    <a href='/create' className='btn-primary text-sm'>
                      ✨ Create Book
                    </a>
                  </div>
                </div>
              </div>
            </nav>
            <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
