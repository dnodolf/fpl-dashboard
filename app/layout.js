import './globals.css'

export const metadata = {
  title: 'FPL Roster Explorer',
  description: 'Advanced Fantasy Premier League Analysis Tool',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}