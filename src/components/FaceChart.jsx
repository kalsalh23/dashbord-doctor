import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/store'
import { Button, Modal } from '../components/ui'
import { isFatimaClinic } from '../lib/clinicStyle'

const TREATMENT_TYPES = [
  { key: 'botox', label: 'بوتوكس', color: '#ef4444' },
  { key: 'filler', label: 'فلير', color: '#f59e0b' },
  { key: 'peeling', label: 'تقشير', color: '#10b981' },
  { key: 'laser', label: 'ليزر', color: '#8b5cf6' },
  { key: 'meso', label: 'ميزوثيرابي', color: '#06b6d4' },
  { key: 'thread', label: 'خيوط', color: '#ec4899' },
  { key: 'other', label: 'أخرى', color: '#64748b' },
]

function treatmentColor(key) {
  const t = TREATMENT_TYPES.find((t) => t.key === key)
  return t ? t.color : '#64748b'
}

function btnColor(key) {
  return key === 'botox' ? 'rose' : key === 'filler' ? 'amber' : key === 'peeling' ? 'emerald' : key === 'laser' ? 'violet' : key === 'meso' ? 'cyan' : key === 'thread' ? 'pink' : 'slate'
}

function treatmentBtnClass(t, selected) {
  const c = btnColor(t.key)
  const active = selected === t.key
  return `flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold transition-colors ${active ? `border-${c}-500 bg-${c}-500/10 text-${c}-700` : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`
}

function createFaceGeometry() {
  const shape = new THREE.Shape()
  const cx = 0
  const cy = 0
  const rx = 1.1
  const ry = 1.5

  // Face outline (chin to forehead)
  shape.moveTo(cx - rx * 0.55, cy - ry * 0.55) // jaw left
  shape.lineTo(cx - rx * 0.85, cy - ry * 0.25) // cheek left
  shape.lineTo(cx - rx * 0.95, cy + ry * 0.05) // temple left
  shape.lineTo(cx - rx * 0.85, cy + ry * 0.35) // forehead left
  shape.lineTo(cx, cy + ry * 0.85) // top center
  shape.lineTo(cx + rx * 0.85, cy + ry * 0.35) // forehead right
  shape.lineTo(cx + rx * 0.95, cy + ry * 0.05) // temple right
  shape.lineTo(cx + rx * 0.85, cy - ry * 0.25) // cheek right
  shape.lineTo(cx + rx * 0.55, cy - ry * 0.55) // jaw right
  shape.lineTo(cx, cy - ry * 0.95) // chin
  shape.lineTo(cx - rx * 0.55, cy - ry * 0.55) // close

  const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.center()
  return geometry
}

function createFeatureGroup() {
  const group = new THREE.Group()

  // Eyes (spheres)
  const eyeGeo = new THREE.SphereGeometry(0.14, 16, 16)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  const lEye = new THREE.Mesh(eyeGeo, eyeMat)
  lEye.position.set(-0.42, 0.15, 0.21)
  const rEye = new THREE.Mesh(eyeGeo, eyeMat)
  rEye.position.set(0.42, 0.15, 0.21)
  group.add(lEye, rEye)

  // Nose (simple bridge)
  const noseGeo = new THREE.ConeGeometry(0.16, 0.5, 16)
  noseGeo.rotateX(Math.PI / 2)
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xe0b080 })
  const nose = new THREE.Mesh(noseGeo, noseMat)
  nose.position.set(0, -0.05, 0.32)
  group.add(nose)

  // Mouth
  const mouthGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16, Math.PI)
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x8b4a4a })
  const mouth = new THREE.Mesh(mouthGeo, mouthMat)
  mouth.rotation.x = Math.PI / 2
  mouth.position.set(0, -0.42, 0.28)
  group.add(mouth)

  return group
}

export default function FaceChart({ patientId, onChange }) {
  const { profile, toast } = useApp()
  const containerRef = useRef(null)
  const [points, setPoints] = useState([])
  const [selectedTreatment, setSelectedTreatment] = useState('filler')
  const [loading, setLoading] = useState(true)
  const isFatima = isFatimaClinic(profile)

  // Load previous face points from all patient visits (stored in specialty_data)
  useEffect(() => {
    if (!patientId || !isFatima) return
    let raf
    const init = async () => {
      setLoading(true)
      try {
        const { data: visits } = await supabase
          .from('visits')
          .select('id, visit_date, specialty_data')
          .eq('patient_id', patientId)
          .order('visit_date', { ascending: true })
        const allPoints = []
        for (const v of visits || []) {
          const sd = v.specialty_data || {}
          if (sd.face_points && Array.isArray(sd.face_points)) {
            for (const p of sd.face_points) {
              allPoints.push({ ...p, visit_id: v.id, visit_date: v.visit_date })
            }
          }
        }
        setPoints(allPoints)
      } catch (e) {
        toast('error', 'تعذر تحميل نقاط العلاج السابقة')
      } finally {
        setLoading(false)
      }
    }
    init()
    raf = requestAnimationFrame(() => {})
    return () => cancelAnimationFrame(raf)
  }, [patientId, isFatima, toast])

  // Save face points to current visit's specialty_data
  useEffect(() => {
    if (!onChange) return
    onChange({ face_points: points })
  }, [points, onChange])

  // Three.js scene
  useEffect(() => {
    if (!containerRef.current || !isFatima) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8f4f2)
    scene.fog = new THREE.Fog(0xf8f4f2, 1, 12)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50)
    camera.position.set(0, 0, 3.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(2, 4, 3)
    scene.add(dirLight)

    const face = new THREE.Mesh(createFaceGeometry(), new THREE.MeshStandardMaterial({ color: 0xecd9c8, roughness: 0.7, metalness: 0.1 }))
    scene.add(face)
    const features = createFeatureGroup()
    face.add(features)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controls.enablePan = false
    controls.minDistance = 2
    controls.maxDistance = 8

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const pointMeshes = []

    function createPointMesh(x, y, z, color, size = 0.08) {
      const geo = new THREE.SphereGeometry(size, 16, 16)
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      scene.add(mesh)
      pointMeshes.push(mesh)
      return mesh
    }

    // Render existing points
    for (const p of points) {
      createPointMesh(p.x, p.y, p.z, treatmentColor(p.treatment || 'other'), 0.09)
    }

    function onClick(event) {
      const rect = containerRef.current.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, camera)
      const intersects = raycaster.intersectObject(face)

      if (intersects.length > 0) {
        const point = intersects[0].point
        const normal = intersects[0].normal
        const p = {
          x: point.x,
          y: point.y,
          z: point.z,
          nx: normal.x,
          ny: normal.y,
          nz: normal.z,
          treatment: selectedTreatment,
          note: '',
          created_at: new Date().toISOString(),
        }
        setPoints((prev) => [...prev, p])
        createPointMesh(point.x, point.y, point.z, treatmentColor(selectedTreatment))
      }
    }

    containerRef.current.addEventListener('pointerdown', onClick)

    function animate() {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      containerRef.current.removeEventListener('pointerdown', onClick)
      controls.dispose()
      renderer.dispose()
      for (const m of pointMeshes) scene.remove(m)
      scene.remove(face, features)
      containerRef.current.innerHTML = ''
    }
  }, [isFatima, points.length, selectedTreatment])

  if (!isFatima) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">خريطة الوجه — نقاط العلاج</h3>
        <div className="flex gap-1">
          {TREATMENT_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelectedTreatment(t.key)}
              className={treatmentBtnClass(t, selectedTreatment)}
              title={t.label}
            >
              <span className="flex h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: treatmentColor(t.key) }} />
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="w-full aspect-square min-h-[300px] bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
            جارٍ تحميل نموذج الوجه...
          </div>
        )}
        <p className="absolute bottom-2 left-2 text-[10px] text-slate-400">
          انقر على مكان في الوجه لإضافة نقطة علاج · الدوارة تلقائياً
        </p>
      </div>

      {points.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
          <p className="text-[10px] font-bold text-slate-500 mb-1">نقاط العلاج المسجلة:</p>
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs">
              <span className="flex h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: treatmentColor(p.treatment || 'other') }} />
              <span className="text-slate-600">{p.treatment || 'أخرى'}</span>
              {p.note && <span className="ml-1 text-slate-400 truncate max-w-[120px]">— {p.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
