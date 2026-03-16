import { useRegisterSW } from 'virtual:pwa-register/react'
import './PWAUpdatePrompt.css'

function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW registered:', r)
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    }
  })

  if (!needRefresh) return null

  return (
    <div className="pwa-toast" role="alert">
      <div className="pwa-toast-message">
        Dostępna nowa wersja aplikacji
      </div>
      <div className="pwa-toast-actions">
        <button className="pwa-toast-btn pwa-toast-btn-reload" onClick={() => updateServiceWorker(true)}>
          Aktualizuj
        </button>
        <button className="pwa-toast-btn pwa-toast-btn-close" onClick={() => setNeedRefresh(false)}>
          Zamknij
        </button>
      </div>
    </div>
  )
}

export default PWAUpdatePrompt
