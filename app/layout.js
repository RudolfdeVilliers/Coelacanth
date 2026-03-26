import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Coelacanth — Anonymous Employee Feedback',
  description: 'Your team has ideas. Surveys don\'t catch them.',
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
