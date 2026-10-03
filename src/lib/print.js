import { useEffect } from 'react'

/**
 * يعزل قالب الطباعة: عند الطباعة يُستنسخ محتوى .print-area إلى حاوية مستقلة
 * خارج شجرة التطبيق، ويُخفى كل شيء آخر — فيخرج البطباع ورقة واحدة نظيفة.
 */
export function usePrintIsolation(sheetSelector = '.print-area') {
  useEffect(() => {
    const before = () => {
      const area = document.querySelector(sheetSelector)
      if (!area) return
      let clone = document.getElementById('print-clone')
      if (!clone) {
        clone = document.createElement('div')
        clone.id = 'print-clone'
        document.body.appendChild(clone)
      }
      clone.innerHTML = area.innerHTML
      document.documentElement.classList.add('printing')
    }
    const after = () => {
      document.documentElement.classList.remove('printing')
      document.getElementById('print-clone')?.remove()
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [sheetSelector])
}
