// ============================================================
// التخزين المحلي — بديل Supabase Storage بلا إنترنت
// الملفات تُحفظ في IndexedDB (جدول files) كمربوطات base64.
// ============================================================
import { tx } from './db.js'

const fileCache = new Map() // 'bucket/path' -> dataUrl (in-memory for sync getPublicUrl)

function key(bucket, path) {
  return bucket + '/' + String(path).replace(/^\/+/, '')
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function createLocalStorage() {
  return {
    from(bucket) {
      return {
        async upload(path, file /* File | Blob */, _opts = {}) {
          try {
            const dataUrl = await fileToDataUrl(file)
            const k = key(bucket, path)
            await tx('files', 'readwrite', (s) => s.put({ type: file.type || '', data: dataUrl }, k))
            fileCache.set(k, dataUrl)
            return { data: { path }, error: null }
          } catch (e) {
            return { data: null, error: { message: e?.message || String(e) } }
          }
        },

        // kept sync like supabase-js; returns the data URL cached by a recent upload
        getPublicUrl(path) {
          const k = key(bucket, path)
          return { data: { publicUrl: fileCache.get(k) || '' } }
        },

        async createSignedUrl(path, _expires) {
          try {
            const rec = await tx('files', 'readonly', (s) => s.get(key(bucket, path)))
            if (!rec) return { data: null, error: { message: 'Object not found' } }
            // object URL works for the rest of the session (viewing / printing)
            const blob = await (await fetch(rec.data)).blob()
            return { data: { signedUrl: URL.createObjectURL(blob) }, error: null }
          } catch (e) {
            return { data: null, error: { message: e?.message || String(e) } }
          }
        },

        async remove(paths) {
          const list = Array.isArray(paths) ? paths : [paths]
          for (const p of list) {
            const k = key(bucket, p)
            await tx('files', 'readwrite', (s) => s.delete(k))
            fileCache.delete(k)
          }
          return { data: list.map((p) => ({ path: p })), error: null }
        },
      }
    },
  }
}
