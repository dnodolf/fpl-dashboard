import './globals.css'

// Separate viewport export (NEW requirement in Next.js 14+)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
}

// Updated metadata with new branding
export const metadata = {
  title: 'Fantasy FC Playbook',  // Clean title without emoji
  description: 'Advanced Fantasy Premier League Analysis Tool',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fantasy FC Playbook'
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Multiple favicon formats for maximum compatibility */}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* Android Chrome Icons */}
        <link rel="icon" href="/android-chrome-192x192.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/android-chrome-512x512.png" sizes="512x512" type="image/png" />
        
        {/* Manifest and PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        
        {/* Apple Web App */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fantasy FC Playbook" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}