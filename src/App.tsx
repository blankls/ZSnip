import { useEffect, useState } from 'react'
import Hello from './Hello'
import Read from './Read'
import Write from './Write'

export default function App() {
  const [enterAction, setEnterAction] = useState<any>({})
  const [route, setRoute] = useState('')

  useEffect(() => {
    window.ztools.onPluginEnter((action) => {
      setRoute(action.code)
      setEnterAction(action)
    })
    window.ztools.onPluginOut(() => {
      setRoute('')
    })
  }, [])

  // 截图路由：不在插件窗口内渲染，而是使用 ZTools 官方 API 创建全屏透明 overlay 窗口
  useEffect(() => {
    if (route === 'screenshot') {
      // 获取 overlay.html 的 URL
      const overlayUrl = window.ztools.isDev()
        ? 'http://localhost:5173/public/overlay.html'
        : './public/overlay.html'
      window.services.createOverlayWindow(overlayUrl).then((result) => {
        if (!result.success) {
          console.error('[ZSnip] 无法创建全屏截图窗口:', result.error)
        }
        window.ztools.outPlugin()
      })
    }
  }, [route])

  if (route === 'hello') return <Hello enterAction={enterAction} />
  if (route === 'read') return <Read enterAction={enterAction} />
  if (route === 'write') return <Write enterAction={enterAction} />

  return null
}