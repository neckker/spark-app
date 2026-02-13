import './index.css'
import App from './App'

import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/context/AuthContext'
import { SettingsProvider } from '@/context/SettingsContext'

createRoot(document.getElementById('root')!).render(
    <AuthProvider>
        <SettingsProvider>
            <App />
        </SettingsProvider>
    </AuthProvider>
)
