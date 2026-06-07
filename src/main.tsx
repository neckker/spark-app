import './index.css'
import App from './App'

import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/context/AuthContext'
import { TokenAnalyzerProvider } from '@/context/TokenAnalyzerContext'

createRoot(document.getElementById('root')!).render(
    <AuthProvider>
        <TokenAnalyzerProvider>
            <App />
        </TokenAnalyzerProvider>
    </AuthProvider>
)
