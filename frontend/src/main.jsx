import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter } from 'react-router-dom'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.jsx'
import { WalletProvider } from './context/WalletContext.jsx'
import { theme } from './theme.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <WalletProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </WalletProvider>
    </MantineProvider>
  </StrictMode>,
)
