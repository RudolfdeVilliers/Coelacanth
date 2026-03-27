import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Coelacanth — One widget. Every tool.',
  description: 'The desktop widget that connects to all your apps. Gmail, Slack, Notion, Figma and more. Just type it. Consider it done.',
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
