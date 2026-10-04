import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// يمنع «الصفحة البيضاء»: أي خطأ وقت التشغيل يظهر برسالة واضحة وزر إعادة تحميل
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info?.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 640, margin: '60px auto' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>حدث خطأ غير متوقع</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 12, color: '#334155' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, background: '#0f766e', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
