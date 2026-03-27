import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Coelacanth — One Coelacanth. Many apps.',
  description: 'A single Coelacanth that connects to all your apps.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.className}>
      <body className="bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
