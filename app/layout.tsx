import './globals.css'
import type {Metadata,Viewport} from 'next'

export const metadata:Metadata={
  title:'Flatout ERP',
  applicationName:'Flatout ERP',
  manifest:'/manifest.webmanifest',
  icons:{
    icon:[{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{url:'/icons/icon-512.png',sizes:'512x512',type:'image/png'}],
    apple:[{url:'/icons/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]
  },
  appleWebApp:{capable:true,title:'Flatout ERP',statusBarStyle:'black'},
  formatDetection:{telephone:false}
}

export const viewport:Viewport={
  themeColor:'#111111',
  width:'device-width',
  initialScale:1,
  viewportFit:'cover'
}

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
