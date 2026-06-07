import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;"><h1>错误：找不到 #root 元素</h1></div>'
} else {
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  } catch (err) {
    root.innerHTML = `<div style="padding:40px;font-family:sans-serif;"><h1>启动错误</h1><pre>${err.message}\n${err.stack}</pre></div>`
  }
}
