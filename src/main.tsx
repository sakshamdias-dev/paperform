import { createRoot } from 'react-dom/client'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.tsx'

if (typeof window !== 'undefined') {
  (window as any).katex = katex;
}

createRoot(document.getElementById('root')!).render(
  <App />,
)
