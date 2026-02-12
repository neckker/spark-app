import './index.css'
import App from './App'

import { createRoot } from 'react-dom/client'
import { SettingsProvider } from '@/context/SettingsContext'

createRoot(document.getElementById('root')!).render(
    <SettingsProvider>
        <App />
    </SettingsProvider>
)
