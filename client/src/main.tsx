import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

console.log('React starting...')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log('React rendered')
