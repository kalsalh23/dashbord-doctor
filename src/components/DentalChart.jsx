import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/store'
import { Button, Field, Input, Modal } from './ui'
import { formatDateShort } from '../lib/format'
import { friendlyDbError } from '../lib/hooks'
import { toothGeometry } from '../lib/toothImages'
import { teethForAge, dentitionLabel, fmtPrice, treatmentGlyph, TREATMENT_TREE, familyOfTreatment, PERM_UPPER_ORDER, PERM_LOWER_ORDER, PRIM_UPPER_ORDER, PRIM_LOWER_ORDER } from '../lib/dental'

// ============================================================
// مخطط الأسنان — صفّان أفقيان بأسنان تشريحية (تاج + جذور) فوق شريط لثة،
// ترقيم FDI، ورمز مصوّر لكل حالة علاج. النقر على أي سن يفتح شبكة
// الحالات (كصور المرجع) مع ملاحظة وزر حفظ الحالة، وتحت الشبكة
// تبقى العلاجات المفصّلة بالأسعار المرتبطة بجدول أسعاري.
// ============================================================

// ============================================================
// حالات السن — كل عائلة علاج لها شكلها الواقعي على السن، وعند اختيارها
// تظهر «أنواعها» من أسعاري (حشوة → ضوئي/أملغم/زجاجي… · تاج → زيركون/إيماكس…)
// العائلات بلا أنواع (تسوس/كسر/مفقود/سليم) تُطبَّق مباشرة.
// ============================================================
const STATE_DEFS = [
  { key: 'سليم', glyph: null, treatment: null, family: null, color: '#f8fafc' },
  { key: 'تسوس', glyph: 'caries', treatment: 'تسوس', family: 'تسوس', color: '#dc2626' },
  { key: 'حشوة', glyph: 'filling', family: 'حشوة', color: '#2563eb' },
  { key: 'تاج', glyph: 'crown', family: 'تاج', color: '#d4a017' },
  { key: 'جسر', glyph: 'bridge', family: 'جسر', color: '#7c3aed', special: 'bridge' },
  { key: 'زرعة', glyph: 'implant', family: 'زراعة', color: '#059669' },
  { key: 'معالج لبّاً', glyph: 'rct', family: 'علاج عصب', color: '#f97316' },
  { key: 'خلع', glyph: 'extraction', family: 'خلع', color: '#1e293b' },
  { key: 'كسر', glyph: 'fracture', treatment: 'كسر', family: null, color: '#64748b' },
  { key: 'تقويم', glyph: 'ortho', family: 'تقويم', color: '#ec4899' },
  { key: 'فينير', glyph: 'veneer', family: 'فينير', color: '#38bdf8' },
  { key: 'لثة', glyph: 'perio', family: 'لثة', color: '#f43f5e' },
  { key: 'وقاية', glyph: 'preventive', family: 'وقاية', color: '#22c55e' },
  { key: 'تبييض', glyph: 'whitening', family: 'تبييض', color: '#f472b6' },
  { key: 'جراحة', glyph: 'other', family: 'جراحة', color: '#b91c1c' },
  { key: 'مفقود', glyph: 'missing', treatment: 'مفقود', family: null, color: '#94a3b8' },
]

// نوع السن التشريحي من رقمه — بأحجام نسبية واقعية
// ============================================================
// الأسنان الآن حقيقية: قوالب تشريحية مقيسة (MIT — React Advanced Odontogram)
// وتأثيرات العلاج تُرسم فوق السن بمحاذاة تشريحية (سطح الإطباق، خطّ العنق، الجذور)
// ============================================================

// تلوين الحالات على السن الحقيقي — عبر مرشّحات لونية واقعية
const BASE_TOOTH_TINT = 'sepia(0.18) saturate(0.72) brightness(0.82) contrast(1.15)' // عاج واقعي أغمق (غير شفاف)
const GOLD_TINT = 'sepia(0.9) saturate(2.8) hue-rotate(-12deg) brightness(1.02) contrast(1.2)' // تاج/جسر ذهبي
const HISTORY_TINT = 'sepia(0.35) saturate(0.9) brightness(0.85) contrast(1.1)' // عولج سابقاً — دافئ خفيف
const GRAY_TINT = 'grayscale(0.85) brightness(0.7) contrast(1.1)' // مخلوع/مفقود

// دمج المرشّحات: الأساسي (عاج واقعي) فوقه مرشّح الحالة
const combineTints = (...tints) => tints.filter(Boolean).join(' ')

// ============================================================
// مواد حقيقية للتأثيرات — تدرّجات SVG تحاكي المواد الفعلية في الفم:
// خزف/زيركون، ذهب، تيتانيوم الزراعة، أملغم (زئبق معدني)، كمبوزيت ضوئي،
// تسوّس داكن محروق، لثة ملتهبة، دم. الأشكال تتبع رموز مخطط الأسنان المعتمدة.
// ============================================================
function TreatmentMaterials() {
  return (
    <defs>
      {/* تاج خزفي/زيركون — أبيض ناصع ببروق خفيف */}
      <linearGradient id="nz-crown" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#f4f6f8" />
        <stop offset="100%" stopColor="#c9d2da" />
      </linearGradient>
      {/* تاج ذهبي — PFM/ذهب مصبوب */}
      <linearGradient id="nz-goldCrown" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fbe08a" />
        <stop offset="45%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#a16207" />
      </linearGradient>
      {/* تيتانيوم الزراعة */}
      <linearGradient id="nz-titanium" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="40%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
      {/* أملغم — رمادي معدني لامع */}
      <linearGradient id="nz-amalgam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#b9c2cc" />
        <stop offset="35%" stopColor="#8792a0" />
        <stop offset="100%" stopColor="#3f4a56" />
      </linearGradient>
      {/* كمبوزيت ضوئي — حشو بلون السن */}
      <linearGradient id="nz-composite" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#eef2f6" />
        <stop offset="100%" stopColor="#b6c0ca" />
      </linearGradient>
      {/* تسوّس — تجويف داكن محروق بلون العفن */}
      <radialGradient id="nz-caries" cx="0.4" cy="0.35" r="0.8">
        <stop offset="0%" stopColor="#000000" />
        <stop offset="45%" stopColor="#2b1206" />
        <stop offset="100%" stopColor="#5c2a12" />
      </radialGradient>
      {/* عصب معالج — جوتا-بيركا حمراء بنية */}
      <linearGradient id="nz-gutta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#7f1d1d" />
        <stop offset="50%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </linearGradient>
      {/* لثة ملتهبة */}
      <linearGradient id="nz-gingiva" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fda4af" />
        <stop offset="100%" stopColor="#e11d48" />
      </linearGradient>
    </defs>
  )
}

// سنّ حقيقي: صورة القالب التشريحي + تأثيرات العلاج فوقه
function ToothArt({ geo, options = {} }) {
  // الأساس الداكن دائماً — ومرشّح الحالة فوقه إن وُجد (حتى لا تبدو الأسنان شفافة)
  const baseFilter = combineTints(BASE_TOOTH_TINT, options.tint)
  return (
    <g transform={`scale(${options.scale || 1})`} opacity={options.dim ? 0.4 : 1}>
      <image
        href={geo.href}
        x={geo.rect.x}
        y={geo.rect.y}
        width={geo.rect.width}
        height={geo.rect.height}
        preserveAspectRatio="xMidYMid meet"
        transform={geo.transform}
        style={{ filter: baseFilter }}
      />
      {/* سنّ مفقود: هالة متقطعة مكان السن */}
      {options.missing && (
        <ellipse
          cx={0}
          cy={(geo.crownTop + geo.crownBottom) / 2}
          rx={geo.crownHalfW + 3}
          ry={(geo.crownBottom - geo.crownTop) / 2 + 6}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.65}
        />
      )}
      {options.overlay}
    </g>
  )
}

// تأثيرات العلاج على السن الحقيقي — موضوعة على السطح التشريحي الصحيح
// كل شكل معبّر عن العلاج نفسه (تسوس/حشو/تاج/زراعة/عصب/كسر/تقويم...) لا مجرد لون
// ============================================================
// تأثيرات العلاج الواقعية على السن الحقيقي — موضوعة على السطح التشريحي الصحيح
// تتبع رموز مخططات الأسنان المعتمدة (ADA/ISO 3950):
//   • تسوّس: حد أحمر حول السطح المتسوّس + تجويف داكن متآكل
//   • حشوة: السطح مصمت بمادة الحشو (أملغم معدني / كمبوزيت بلون السن)
//   • تاج: غطاء كامل للتاج بمواد حقيقية (زيركون/ذهب) مع حدّ عند خطّ العنق
//   • عصب: خط رأسي في كل جذر معبأ بالجوتا-بيركا
//   • زرعة: برغي تيتانيوم حلزوني + دعامة + تاج
//   • كسر: شقّ يعبر التاج · خلع: X · مفقود: X على كامل السن
//   • تقويم: bracket + سلك · جسر: وصلة بين تاجين · لثة: التهاب حول العنق
// ============================================================
function treatmentOverlay(g, geo) {
  if (!g) return null
  const { crownTop, crownBottom, rootBottom, crownHalfW, rootHalfW } = geo
  const crownH = crownBottom - crownTop
  const occlY = crownTop + crownH * 0.24 // سطح الإطباق/الحافة القاطعة
  const midY = crownTop + crownH * 0.5
  const neckY = crownBottom - crownH * 0.08
  const ns = { pointerEvents: 'none' }
  const w = Math.max(5, crownHalfW)

  switch (g) {
    case 'caries':
      // تسوّس: تجويف داكن متآكل + حدّ أحمر حول السطح (رمز التسوّس القياسي)
      return (
        <g transform={`translate(0,${occlY})`} style={ns}>
          {/* التجويف المتآكل */}
          <path
            d={`M ${-w * 1.02},-3.2 Q ${-w * 0.5},-7.8 ${w * 0.15},-6.4 Q ${w * 1.02},-7.4 ${w * 0.95},-1 Q ${w * 1.1},4.2 ${w * 0.05},5 Q ${-w * 0.8},5.6 ${-w * 1.02},-3.2 Z`}
            fill="url(#nz-caries)"
            stroke="#7f1d1d"
            strokeWidth={0.9}
          />
          {/* قلب التجويف الأسود */}
          <ellipse cx={w * 0.05} cy={-0.6} rx={w * 0.45} ry={2.6} fill="#000000" opacity={0.9} />
          {/* حواف مثقوبة متكسّرة */}
          <path d={`M ${-w * 0.75},-2.6 Q ${-w * 0.2},-4.6 ${w * 0.35},-3.6`} fill="none" stroke="#3f1a0a" strokeWidth={0.6} opacity={0.8} />
          {/* حدّ أحمر للسطح المتسوّس (الرمز القياسي للتسوّس) */}
          <path
            d={`M ${-w * 1.2},-4.4 Q 0,${-9} ${w * 1.2},-4.4 Q ${w * 1.3},4.6 0,6.2 Q ${-w * 1.3},4.6 ${-w * 1.2},-4.4 Z`}
            fill="none"
            stroke="#dc2626"
            strokeWidth={1.1}
            opacity={0.95}
          />
        </g>
      )
    case 'amalgam':
      // حشوة أملغم معدنية: السطح مصمت بمعدن رمادي لامع (الرمز القياسي للحشوة المعدنية)
      return (
        <g transform={`translate(0,${occlY})`} style={ns}>
          <path
            d={`M ${-w * 1.05},-3.4 Q ${-w * 0.3},-6.6 ${w * 0.4},-5.4 Q ${w * 1.08},-4.2 ${w * 0.98},0.6 Q ${w * 1.08},3.8 ${w * 0.12},4.4 Q ${-w * 0.78},4.8 ${-w * 1.05},-3.4 Z`}
            fill="url(#nz-amalgam)"
            stroke="#1e293b"
            strokeWidth={0.85}
          />
          {/* لمععة المعدن */}
          <path d={`M ${-w * 0.62},-2.8 Q 0,${-4.4} ${w * 0.52},-2.4`} fill="none" stroke="#ffffff" strokeWidth={1.1} opacity={0.75} />
          <path d={`M ${-w * 0.62},${-2.2} Q 0,${-3.6} ${w * 0.52},${-1.8}`} fill="none" stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
          <circle cx={w * 0.58} cy={1.4} r={0.7} fill="#0f172a" opacity={0.35} />
        </g>
      )
    case 'filling':
      // حشوة كمبوزيت ضوئي: مادة بلون السن مع حدود دقيقة وشطف ضوئي
      return (
        <g transform={`translate(0,${occlY})`} style={ns}>
          <path
            d={`M ${-w * 1.05},-3.4 Q ${-w * 0.3},-6.6 ${w * 0.4},-5.4 Q ${w * 1.08},-4.2 ${w * 0.98},0.6 Q ${w * 1.08},3.8 ${w * 0.12},4.4 Q ${-w * 0.78},4.8 ${-w * 1.05},-3.4 Z`}
            fill="url(#nz-composite)"
            stroke="#7c8794"
            strokeWidth={0.8}
          />
          {/* شطف الحدّ (marginal ridge) */}
          <path d={`M ${-w * 1.0},-3 Q 0,${-5.6} ${w * 0.95},-3`} fill="none" stroke="#94a3b8" strokeWidth={0.55} opacity={0.9} />
          {/* بريق الكمبوزيت */}
          <path d={`M ${-w * 0.5},-2.4 Q 0,${-4} ${w * 0.42},-2.2`} fill="none" stroke="#ffffff" strokeWidth={1.2} opacity={0.95} />
          <circle cx={w * 0.55} cy={1.2} r={0.6} fill="#cbd5e1" opacity={0.6} />
        </g>
      )
    case 'crown':
      // تاج: غطاء كامل للتاج بمواد حقيقية + حدّ عند خطّ العنق
      return (
        <g style={ns}>
          <path
            d={`M ${-crownHalfW * 1.06},${crownTop - 0.6} L ${crownHalfW * 1.06},${crownTop - 0.6} L ${crownHalfW * 1.02},${crownBottom + 0.6} Q 0,${crownBottom + 3.4} ${-crownHalfW * 1.02},${crownBottom + 0.6} Z`}
            fill="url(#nz-crown)"
            stroke="#475569"
            strokeWidth={0.9}
          />
          {/* بروق الخزف */}
          <path d={`M ${-crownHalfW * 0.66},${crownTop + 1.2} L ${crownHalfW * 0.24},${crownTop + 1.2}`} stroke="#ffffff" strokeWidth={1.3} opacity={0.9} strokeLinecap="round" />
          <path d={`M ${-crownHalfW * 0.5},${crownTop + crownH * 0.42} L ${crownHalfW * 0.3},${crownTop + crownH * 0.42}`} stroke="#ffffff" strokeWidth={0.8} opacity={0.55} strokeLinecap="round" />
          {/* حدّ التاج عند خطّ العنق — العلامة المميزة للتاج في المخططات */}
          <path
            d={`M ${-crownHalfW * 1.02},${crownBottom - 2} Q 0,${crownBottom + 3.6} ${crownHalfW * 1.02},${crownBottom - 2}`}
            fill="none"
            stroke="#334155"
            strokeWidth={2}
            opacity={0.95}
          />
        </g>
      )
    case 'implant': {
      // زراعة: برغي تيتانيوم حلزوني + دعامة + تاج فوقه
      const sTop = crownBottom + 1.5
      const sBot = Math.min(rootBottom - 1, sTop + 36)
      return (
        <g style={ns}>
          {/* تاج الزراعة */}
          <path
            d={`M ${-crownHalfW * 0.98},${crownTop - 0.4} L ${crownHalfW * 0.98},${crownTop - 0.4} L ${crownHalfW * 0.94},${crownBottom + 0.4} Q 0,${crownBottom + 2.6} ${-crownHalfW * 0.94},${crownBottom + 0.4} Z`}
            fill="url(#nz-crown)"
            stroke="#475569"
            strokeWidth={0.85}
          />
          <path d={`M ${-crownHalfW * 0.5},${crownTop + 1} L ${crownHalfW * 0.2},${crownTop + 1}`} stroke="#ffffff" strokeWidth={1} opacity={0.9} strokeLinecap="round" />
          {/* الدعامة (abutment) */}
          <rect x={-3.6} y={crownBottom - 1.4} width={7.2} height={3.4} rx={0.7} fill="url(#nz-titanium)" stroke="#334155" strokeWidth={0.9} />
          {/* جسم البرغي */}
          <path d={`M -4.4,${sTop} L 4.4,${sTop} L 3.2,${sBot} L -3.2,${sBot} Z`} fill="url(#nz-titanium)" stroke="#334155" strokeWidth={1.2} />
          {/* الحلزون */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const y = sTop + ((sBot - sTop) * (i + 0.5)) / 7
            return <line key={i} x1={i % 2 ? -3.9 : -3.4} y1={y} x2={i % 2 ? 3.2 : 3.9} y2={y + 2.2} stroke="#475569" strokeWidth={1.1} strokeLinecap="round" />
          })}
          {/* رأس البرغي */}
          <ellipse cx={0} cy={sTop + 0.5} rx={4.6} ry={2.1} fill="#f1f5f9" stroke="#334155" strokeWidth={1.1} />
        </g>
      )
    }
    case 'rct':
      // معالجة لبّ: قناة معالجة في كل جذر (خط رأسي — الرمز القياسي)
      return (
        <g style={ns}>
          {/* غطاء الإطباق بعد العلاج */}
          <path d={`M ${-crownHalfW * 0.85},${crownTop + 1.6} L ${crownHalfW * 0.85},${crownTop + 1.6} L ${crownHalfW * 0.64},${crownTop + crownH * 0.3} L ${-crownHalfW * 0.64},${crownTop + crownH * 0.3} Z`} fill="url(#nz-composite)" stroke="#94a3b8" strokeWidth={0.7} opacity={0.95} />
          {[-0.46, 0, 0.46].map((f, i) => {
            const x = f * 2 * rootHalfW
            return (
              <g key={i}>
                {/* حشو القناة (جوتا-بيركا) */}
                <line x1={x} y1={crownBottom + 0.5} x2={x * 0.84} y2={rootBottom - 2.5} stroke="url(#nz-gutta)" strokeWidth={2.4} strokeLinecap="round" />
                {/* لمععة */}
                <line x1={x - 0.5} y1={crownBottom + 1.5} x2={x * 0.84 - 0.5} y2={rootBottom - 3} stroke="#fca5a5" strokeWidth={0.55} strokeLinecap="round" opacity={0.85} />
              </g>
            )
          })}
        </g>
      )
    case 'fracture':
      // كسر: شقّ يعبر التاج كاملاً مع فراغ (رمز الكسر القياسي)
      return (
        <g transform={`translate(0,${midY})`} style={ns}>
          <polyline
            points="-12,10 -8,-1.5 -4,5.5 0,-10 4.5,3.5 8,-7 12,8"
            fill="none"
            stroke="#0f172a"
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="-12,10 -8,-1.5 -4,5.5 0,-10 4.5,3.5 8,-7 12,8"
            fill="none"
            stroke="#475569"
            strokeWidth={0.75}
            strokeLinecap="round"
            opacity={0.6}
          />
          {/* بريق الحافة المكسورة */}
          <path d="M -1,-11.5 L 1.2,-10.5" stroke="#ffffff" strokeWidth={0.8} opacity={0.9} strokeLinecap="round" />
        </g>
      )
    case 'ortho':
      // تقويم: bracket معدني + سلك قوسي
      return (
        <g transform={`translate(0,${midY})`} style={ns}>
          <rect x={-5.4} y={-5.4} width={10.8} height={10.8} rx={1.8} fill="url(#nz-crown)" stroke="#1e293b" strokeWidth={1.5} />
          <rect x={-3.6} y={-3.6} width={7.2} height={7.2} rx={1.1} fill="none" stroke="#94a3b8" strokeWidth={0.7} />
          <rect x={-1.6} y={-1.6} width={3.2} height={3.2} rx={0.5} fill="#64748b" opacity={0.7} />
          {/* السلك القوسي */}
          <line x1={-8.5} y1={-0.9} x2={8.5} y2={-0.9} stroke="#be185d" strokeWidth={1.2} strokeLinecap="round" />
          <line x1={-8.5} y1={0.9} x2={8.5} y2={0.9} stroke="#9f1239" strokeWidth={0.7} strokeLinecap="round" opacity={0.75} />
        </g>
      )
    case 'veneer':
      // فينير: طبقة خزفية رقيقة على السطح الأمامي مع بريق
      return (
        <g style={ns}>
          <path
            d={`M ${-crownHalfW * 0.94},${crownTop + 1.2} Q 0,${crownTop - 2} ${crownHalfW * 0.94},${crownTop + 1.2} Q ${crownHalfW * 0.76},${crownTop + crownH * 0.72} 0,${crownTop + crownH * 0.8} Q ${-crownHalfW * 0.76},${crownTop + crownH * 0.72} ${-crownHalfW * 0.94},${crownTop + 1.2} Z`}
            fill="url(#nz-crown)"
            opacity={0.95}
            stroke="#0ea5e9"
            strokeWidth={1}
          />
          <path d={`M ${-crownHalfW * 0.52},${crownTop + 2.2} Q ${-crownHalfW * 0.1},${crownTop + crownH * 0.32} ${crownHalfW * 0.38},${crownTop + 2}`} fill="none" stroke="#ffffff" strokeWidth={1.1} opacity={0.9} />
        </g>
      )
    case 'other':
      return (
        <g style={ns}>
          <circle cx={0} cy={occlY} r={3.6} fill="#a78bfa" />
          <circle cx={0} cy={occlY} r={1.6} fill="#ede9fe" opacity={0.85} />
        </g>
      )
    case 'extraction':
      // خلع: السنّ متضاءل + علامة X (الرمز القياسي للمخلوع/المفقود)
      return (
        <g style={ns}>
          <g stroke="#0f172a" strokeWidth={3} strokeLinecap="round">
            <line x1={-w * 0.95} y1={crownTop + 2} x2={w * 0.95} y2={crownTop + crownH * 0.72} />
            <line x1={w * 0.95} y1={crownTop + 2} x2={-w * 0.95} y2={crownTop + crownH * 0.72} />
          </g>
          <g stroke="#64748b" strokeWidth={0.8} strokeLinecap="round" opacity={0.7}>
            <line x1={-w * 0.95} y1={crownTop + 2} x2={w * 0.95} y2={crownTop + crownH * 0.72} />
            <line x1={w * 0.95} y1={crownTop + 2} x2={-w * 0.95} y2={crownTop + crownH * 0.72} />
          </g>
        </g>
      )
    case 'missing':
      // مفقود: X على كامل السن (رمز المفقود القياسي)
      return (
        <g style={ns}>
          <g stroke="#1e293b" strokeWidth={2.6} strokeLinecap="round" opacity={0.9}>
            <line x1={-w * 0.8} y1={crownTop - 2} x2={w * 0.8} y2={neckY + 4} />
            <line x1={w * 0.8} y1={crownTop - 2} x2={-w * 0.8} y2={neckY + 4} />
          </g>
        </g>
      )
    case 'cleaning':
    case 'whitening':
      // تنظيف/تبييض: بريق ناصع (نجوم)
      return (
        <g transform={`translate(0,${occlY})`} style={ns}>
          <path d="M 0,-12 L 2,-6.8 L 7.4,-5.6 L 3.4,-1.8 L 4.6,3.2 L 0,0.8 L -4.6,3.2 L -3.4,-1.8 L -7.4,-5.6 L -2,-6.8 Z" fill="#fef9c3" stroke="#facc15" strokeWidth={0.6} />
          <circle cx={-8} cy={-8} r={1.5} fill="#ffffff" />
          <circle cx={8} cy={-8} r={1.5} fill="#ffffff" />
          <circle cx={0} cy={-13} r={1.1} fill="#ffffff" opacity={0.9} />
        </g>
      )
    case 'preventive':
      // وقاية: شارة حماية (فلورايد/سدود)
      return (
        <g style={ns}>
          <circle cx={0} cy={midY} r={5.6} fill="#dcfce7" stroke="#16a34a" strokeWidth={1.2} />
          <path d={`M ${-2.8},${midY} L ${-0.8},${midY + 2.4} L 3,${midY - 2.2}`} fill="none" stroke="#15803d" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'perio':
      // التهاب لثة: منطقة ملتهبة حول خطّ العنق مع تورّم (رمز الجيب اللثوي)
      return (
        <g style={ns}>
          <path
            d={`M ${-crownHalfW},${neckY - 1} Q 0,${neckY + 4.5} ${crownHalfW},${neckY - 1} Q 0,${neckY + 1} ${-crownHalfW},${neckY - 1} Z`}
            fill="url(#nz-gingiva)"
            opacity={0.9}
          />
          {[-0.72, -0.26, 0.26, 0.72].map((f, i) => (
            <circle key={i} cx={f * crownHalfW} cy={neckY + 0.5} r={2} fill="#e11d48" />
          ))}
        </g>
      )
    default:
      return null
  }
}


// رمز الحالة فوق السنّ — نسخة مصغرة تُستخدم في الدليل وشبكة النافذة
function StateIcon({ def, size = 34, active }) {
  const geo = toothGeometry(11)
  return (
    <svg width={size} height={size * 1.25} viewBox="-20 -24 40 52" aria-hidden="true">
      <TreatmentMaterials />
      <ToothArt
        geo={geo}
        options={{
          scale: 0.8,
          dim: def.glyph === 'extraction',
          missing: def.glyph === 'missing',
          // الأشكال الواقعية تُرسم فوق السن — تلوين فقط للمخلوع والمفقود
          tint: def.glyph === 'extraction' ? GRAY_TINT : undefined,
          overlay: treatmentOverlay(def.glyph, geo),
        }}
      />
    </svg>
  )
}


const W = 1000
const GAP = 30

export default function DentalChart({ patientId, age, entries, pricebook, onEntriesChange, persistHistory = false }) {
  const { toast } = useApp()
  const [history, setHistory] = useState([])
  const [activeTooth, setActiveTooth] = useState(null)
  const [hover, setHover] = useState(null)
  const [cat, setCat] = useState('')
  const [notes, setNotes] = useState('')
  const [forcedType, setForcedType] = useState(null) // دائمة / لبنية — يدوياً
  const [bridge, setBridge] = useState(null)
  const [removingHistory, setRemovingHistory] = useState(false)
  const [familyPick, setFamilyPick] = useState(null) // شبكة أنواع العلاج المفتوحة { def, types }

  useEffect(() => {
    if (!patientId) return
    supabase
      .from('dental_chart_entries')
      .select('id, tooth_no, procedure, notes, created_at, visit:visits(visit_date)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setHistory(data || []))
  }, [patientId])

  const dentition = useMemo(() => {
    if (forcedType === 'permanent') return { upper: PERM_UPPER_ORDER, lower: PERM_LOWER_ORDER, type: 'permanent' }
    if (forcedType === 'primary') return { upper: PRIM_UPPER_ORDER, lower: PRIM_LOWER_ORDER, type: 'primary' }
    return teethForAge(age)
  }, [age, forcedType])
  const { upper, lower, type } = dentition

  const historyByTooth = useMemo(() => {
    const m = {}
    for (const e of history) if (!m[e.tooth_no]) m[e.tooth_no] = e
    return m
  }, [history])

  const stagedByTooth = useMemo(() => {
    const m = {}
    for (const e of entries) {
      m[e.tooth_no] = m[e.tooth_no] || []
      m[e.tooth_no].push(e)
    }
    return m
  }, [entries])

  const categories = useMemo(() => {
    const seen = []
    for (const p of pricebook || []) if (!seen.includes(p.category)) seen.push(p.category)
    return seen
  }, [pricebook])

  // حالة السن الحالية (من إدخالات اليوم ثم من السجل السابق)
  const currentStateKey = (no) => {
    const b = entries.find((e) => e.bridge && (e.span || e.teeth).includes(no))
    if (b) return 'جسر'
    const list = stagedByTooth[no]
    const g = list && list.length ? treatmentGlyph(list[list.length - 1].treatment) : historyByTooth[no] ? treatmentGlyph(historyByTooth[no].procedure) : null
    if (!g) return 'سليم'
    const def = STATE_DEFS.find((d) => d.glyph === g)
    return def ? def.key : 'أخرى'
  }

  const openTooth = (no) => {
    if (bridge && !bridge.to) {
      if (no === bridge.from) return
      setBridge({ ...bridge, to: no })
      return
    }
    setActiveTooth(no)
    setFamilyPick(null)
    setCat('')
    setNotes('')
  }

  const spanFor = (from, to) => {
    const upperSet = [...dentition.upper]
    const lowerSet = [...dentition.lower]
    if (upperSet.includes(from) && upperSet.includes(to)) {
      const i1 = upperSet.indexOf(from)
      const i2 = upperSet.indexOf(to)
      return upperSet.slice(Math.min(i1, i2), Math.max(i1, i2) + 1)
    }
    if (lowerSet.includes(from) && lowerSet.includes(to)) {
      const i1 = lowerSet.indexOf(from)
      const i2 = lowerSet.indexOf(to)
      return lowerSet.slice(Math.min(i1, i2), Math.max(i1, i2) + 1)
    }
    return [from, to]
  }

  const confirmBridge = () => {
    if (!bridge?.to) return
    const span = spanFor(bridge.from, bridge.to)
    const item = (pricebook || []).find((p) => (p.treatment || '').includes('جسر')) || { price: 0, color: '#7c3aed' }
    onEntriesChange([
      ...entries,
      {
        bridge: true,
        teeth: [bridge.from, bridge.to],
        span,
        category: 'تركيبات خزفية',
        treatment: 'جسر',
        price: Number(item.price) || 0,
        color: item.color || '#7c3aed',
        notes: null,
      },
    ])
    setBridge(null)
  }

  const bridgeFor = (no) => entries.find((e) => e.bridge && (e.span || e.teeth).includes(no))

  // أنواع علاج عائلة معيّنة — من أسعاري العيادة (حشوة → ضوئي/أملغم/…) وإن لم تُسعَّر بعد من الشجرة الافتراضية
  const familyTypes = (family) => {
    const fromBook = (pricebook || []).filter((p) => p.category === family)
    if (fromBook.length) return fromBook
    // القائمة الافتراضية حتى يثبّت الطبيب أسعاره من «أسعاري»
    const tree = TREATMENT_TREE.find((g) => g.family === family)
    return tree ? tree.items.map((i) => ({ category: family, ...i })) : []
  }

  // تطبيق نوع علاج محدد على السن (الأنواع تأتي من شبكة الأنواع أو من الأسعار المفصّلة)
  const applyTreatment = (p) => {
    if (!activeTooth) return
    const family = familyOfTreatment(p.treatment) || p.category
    // النوع يستبدل علاجات نفس العائلة على السن — ويُبقي علاجات العائلات الأخرى
    const kept = entries.filter(
      (e) => !(e.tooth_no === activeTooth && !e.bridge && (familyOfTreatment(e.treatment) === family || e.category === family))
    )
    onEntriesChange([
      ...kept,
      {
        tooth_no: activeTooth,
        category: p.category || family,
        treatment: p.treatment,
        price: Number(p.price) || 0,
        color: p.color || 'var(--p600)',
        notes: notes.trim() || null,
      },
    ])
    setNotes('')
  }

  // تطبيق حالة من الشبكة المصوّرة — العائلات ذات الأنواع تفتح شبكة الأنواع أولاً
  const applyState = (def) => {
    if (!activeTooth) return
    if (def.special === 'bridge') {
      setBridge({ from: activeTooth })
      setActiveTooth(null)
      return
    }
    // حالات بلا عائلة (سليم/كسر/مفقود) — تُطبَّق مباشرة
    if (!def.family) {
      onEntriesChange(entries.filter((e) => !(e.tooth_no === activeTooth && !e.bridge)))
      setActiveTooth(null)
      return
    }
    const types = familyTypes(def.family)
    if (types.length > 1) {
      // عائلة لها أنواع → اعرض أنواعها ليختار الطبيب النوع بالسعر
      setFamilyPick({ def, types })
      return
    }
    if (types.length === 1) {
      applyTreatment(types[0])
      setActiveTooth(null)
      return
    }
    // عائلة بلا أنواع معرّفة — تُسجَّل باسم العائلة نفسها
    onEntriesChange([
      ...entries.filter((e) => !(e.tooth_no === activeTooth && !e.bridge && (familyOfTreatment(e.treatment) === def.family || e.category === def.family))),
      {
        tooth_no: activeTooth,
        category: def.family,
        treatment: def.family,
        price: 0,
        color: def.color,
        notes: notes.trim() || null,
      },
    ])
    setActiveTooth(null)
  }

  const removeEntryAt = (index) => onEntriesChange(entries.filter((_, i) => i !== index))
  const removeToothTreatments = () => onEntriesChange(entries.filter((e) => e.tooth_no !== activeTooth))

  // إزالة علامة السن السابقة (عيادة د. عارف) — بعد انتهاء العلاج يُزيل الطبيب الرسم عن السن
  const removeHistoryTooth = async () => {
    if (!activeTooth || !patientId) return
    setRemovingHistory(true)
    const { error } = await supabase
      .from('dental_chart_entries')
      .delete()
      .eq('patient_id', patientId)
      .eq('tooth_no', activeTooth)
    setRemovingHistory(false)
    if (error) {
      toast('error', friendlyDbError(error) || 'تعذّرت إزالة العلامة')
      return
    }
    setHistory((prev) => prev.filter((e) => e.tooth_no !== activeTooth))
    toast('success', `أُزيلت العلامة السابقة عن السن ${activeTooth}`)
    setActiveTooth(null)
  }

  // مظهر السن الحقيقي بحسب حالاته: تاج ذهبي / مفقود / مخلوع / عولج سابقاً
  // عيادة د. عارف (persistHistory): عند غياب علاج اليوم نقرأ آخر علاج محفوظ للسن
  // فنبقى شكل العلاج والمشكلة مرسومَين على السن في كل زيارة قادمة — بلا تغيير
  // على سلوك بقية العيادات (اِحمتراف: تلوين دافئ خفيف كما كان).
  const colors = (no) => {
    const b = bridgeFor(no)
    if (b) return { tint: GOLD_TINT, isStaged: true }
    const list = stagedByTooth[no]
    const last = list && list.length ? list[list.length - 1] : null
    const h = historyByTooth[no]

    // --- عيادة تُثبّت الأشكال: اقرأ السجل السابق للسن بنفس قواعد علاج اليوم ---
    if (!last && h && persistHistory) {
      const ht = String(h.procedure || '')
      if (ht === 'مفقود') return { missing: true }
      if (ht.includes('خلع') || ht.includes('قلع')) return { tint: GRAY_TINT, dim: true, extracted: true }
      // التاج: التاج الواقعي مرسوم فوق السن — لا نحتاج تلويناً تحته
      if (['تلبيسة', 'تاج', 'طوق'].some((wd) => ht.includes(wd))) return { isStaged: false, isHistory: true }
      return { isStaged: false, isHistory: true }
    }

    const t = last ? String(last.treatment || '') : ''
    if (t === 'مفقود') return { missing: true, isStaged: true }
    if (t.includes('خلع') || t.includes('قلع')) return { tint: GRAY_TINT, dim: true, extracted: true, isStaged: true }
    // التاج: التاج الواقعي مرسوم فوق السن (زيركون/ذهب) — بلا تلوين تحته
    if (['تلبيسة', 'تاج', 'طوق'].some((wd) => t.includes(wd))) return { isStaged: true }
    // باقي الحالات: يبقى العاج طبيعياً وشكل العلاج يظهر فوق السن
    if (last) return { isStaged: true }
    if (h) return { tint: HISTORY_TINT, isStaged: false }
    return { isStaged: false }
  }

  // ---- الهندسة: مواضع الأسنان في الصف ----
  const rowGeom = (teeth) => {
    const cellW = Math.min(56, (W - 80 - (teeth.length > 8 ? GAP : 0)) / teeth.length)
    const totalW = teeth.length * cellW + (teeth.length > 8 ? GAP : 0)
    const startX = (W - totalW) / 2
    const pos = (i) => ({
      x: startX + cellW * i + cellW / 2 + (i >= Math.ceil(teeth.length / 2) && teeth.length > 8 ? GAP : 0),
      cellW,
    })
    return { cellW, startX, pos, totalW }
  }

  const gumY = (row) => (row === 'upper' ? { y: 74, h: 30 } : { y: 300, h: 30 })
  const rowCenter = (row) => (row === 'upper' ? 148 : 268)

  const renderRow = (teeth, row) => {
    const { cellW, pos, totalW, startX } = rowGeom(teeth)
    const flip = row === 'lower'
    const s = flip ? 1 : -1
    const cy = rowCenter(row)
    const g = gumY(row)
    const scale = type !== 'permanent' ? 0.85 : 0.95
    return (
      <g key={row}>
        {/* شريط اللثة */}
        <rect x={startX + 4} y={g.y} width={totalW - 8} height={g.h} rx={12} fill="#f8c9d4" opacity={0.85} />
        {/* وصلات الجسور خلف الأسنان — وصلة prosthetics بين تاجين مع سنّ صناعي وسطي */}
        {(entries || [])
          .filter((e) => e.bridge && teeth.includes(e.span[0]))
          .map((b, i) => {
            const i1 = teeth.indexOf(b.span[0])
            const i2 = teeth.indexOf(b.span[b.span.length - 1])
            if (i1 < 0 || i2 < 0) return null
            const p1 = pos(i1)
            const p2 = pos(i2)
            const yBridge = cy + (row === 'lower' ? 6 : -6)
            return (
              <g key={'br' + row + i}>
                {/* وصلة الجسر */}
                <line x1={p1.x} y1={yBridge} x2={p2.x} y2={yBridge} stroke="#7c3aed" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
                <line x1={p1.x} y1={yBridge - 2} x2={p2.x} y2={yBridge - 2} stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
                {/* السنّ الصناعي السطي (pontic) */}
                <ellipse cx={(p1.x + p2.x) / 2} cy={cy + (row === 'lower' ? 2 : -2)} rx={Math.max(4, (p2.x - p1.x) / 4)} ry={9} fill="#ede9fe" stroke="#7c3aed" strokeWidth={1.6} opacity={0.95} />
              </g>
            )
          })}
        {teeth.map((no, i) => {
          const { x } = pos(i)
          const c = colors(no)
          const isActive = activeTooth === no
          const isHover = hover === no
          const list = stagedByTooth[no] || []
          const h = historyByTooth[no]
          // شكل العلاج: من علاجات اليوم، وإلا (عيادة د. عارف) من آخر علاج محفوظ على السن
          const glyph = list && list.length
            ? treatmentGlyph(list[list.length - 1].treatment)
            : persistHistory && h
              ? treatmentGlyph(h.procedure)
              : null
          const geo = toothGeometry(no)
          return (
            <g
              key={no}
              transform={`translate(${x},${cy})`}
              onClick={() => openTooth(no)}
              onMouseEnter={() => setHover(no)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <title>
                {`السن ${no}${list.length ? ' — اليوم: ' + list.map((e) => e.treatment).join(' + ') : ''}${
                  !list.length && h ? ' — سابقاً: ' + h.procedure : ''
                }`}
              </title>
              {isActive && <rect x={-cellW / 2 + 2} y={-46 * s} width={cellW - 4} height={92 * s} rx={10} fill="var(--p600)" opacity={0.12} />}
              {/* السن الحقيقي — الجذور للاتجاه المناسب */}
              <g transform={`scale(1,${s})`}>
                <ToothArt
                  geo={geo}
                  options={{
                    tint: c.tint,
                    dim: c.dim,
                    missing: c.missing,
                    overlay: c.missing ? null : c.extracted && !glyph ? treatmentOverlay('extraction', geo) : glyph ? treatmentOverlay(glyph, geo) : null,
                  }}
                />
              </g>
              {(isHover || isActive) && (
                <rect x={-cellW / 2 + 3} y={-44 * s} width={cellW - 6} height={88 * s} rx={9} fill="none" stroke="var(--p700)" strokeWidth={2} strokeDasharray="4 3" />
              )}
              {/* رقم السن — خارج شريط اللثة */}
              <text
                y={flip ? g.y + g.h + 16 : g.y - 10}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={c.isStaged ? 'var(--p700)' : h ? '#a16207' : '#94a3b8'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {no}
              </text>
              {/* شارة عدد علاجات اليوم */}
              {(list.length || 0) > 1 && (
                <g>
                  <circle cx={cellW / 2 - 4} cy={flip ? -34 : 34} r={8} fill="var(--p700)" />
                  <text x={cellW / 2 - 4} y={flip ? -31 : 37} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none' }}>
                    {list.length}
                  </text>
                </g>
              )}
            </g>
          )
        })}
        {/* R / L */}
        <text x={startX - 18} y={cy + 4} textAnchor="middle" fontSize={14} fontWeight={800} fill="#cbd5e1">
          R
        </text>
        <text x={startX + totalW + 18} y={cy + 4} textAnchor="middle" fontSize={14} fontWeight={800} fill="#cbd5e1">
          L
        </text>
      </g>
    )
  }

  const usedTreatments = useMemo(() => {
    const m = new Map()
    for (const e of entries) m.set(e.treatment, e.color)
    return [...m.entries()]
  }, [entries])

  return (
    <div>
      {/* تبويب نوع السنين — مثل المرجع */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-400">{dentitionLabel(type)} — العمر: {age ?? '—'}</p>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          {[
            { k: null, label: 'حسب العمر' },
            { k: 'permanent', label: 'دائمة' },
            { k: 'primary', label: 'لبنية' },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setForcedType(t.k)}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                forcedType === t.k ? 'bg-primary-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-2">
        <svg viewBox={`0 0 ${W} 400`} className="mx-auto block h-auto w-full" role="img" aria-label="مخطط الفكين العلوي والسفلي">
          {/* مواد حقيقية للتأثيرات (خزف/ذهب/تيتانيوم/أملغم/تسوّس/جوتا) */}
          <TreatmentMaterials />
          {renderRow(upper, 'upper')}
          {renderRow(lower, 'lower')}
        </svg>

        {bridge && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-2.5">
            {!bridge.to ? (
              <p className="text-xs font-bold text-violet-800">جسر: اختر الآن السن الآخر الذي سيتصل به من الفك — السن الأول: {bridge.from}</p>
            ) : (
              <p className="text-xs font-bold text-violet-800">جسر من السن {bridge.from} إلى السن {bridge.to} — يؤشر «تحديد الجسر» للتلوين والحساب</p>
            )}
            <Button size="sm" disabled={!bridge.to} onClick={confirmBridge}>تحديد الجسر</Button>
            <Button size="sm" variant="secondary" onClick={() => setBridge(null)}>إلغاء</Button>
          </div>
        )}
      </div>

      {/* دليل الحالات المصوّر */}
      <div className="mt-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
        <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-1">
          {STATE_DEFS.map((d) => (
            <span key={d.key} className="inline-flex flex-col items-center">
              <StateIcon def={d} size={22} />
              <span className="text-[9px] font-bold text-slate-500">{d.key}</span>
            </span>
          ))}
        </div>
        {usedTreatments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-50 pt-1.5 text-[10px] font-semibold text-slate-500">
            {usedTreatments.map(([t, c]) => (
              <span key={t} className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border" style={{ background: c, borderColor: c }} /> {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* إدخالات هذه الزيارة */}
      {entries.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {entries.map((e, idx) => (
            <li key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs">
              <span className="flex items-center gap-2 font-bold text-primary-900">
                <span className="inline-block h-3 w-3 rounded border" style={{ background: e.color, borderColor: e.color }} />
                {e.bridge
                  ? `جسر من السن ${e.teeth[0]} إلى ${e.teeth[1]} (يشمل ${e.span.length} أسنان)`
                  : `السن ${e.tooth_no} — ${e.treatment}`}
                {e.price ? <span className="text-slate-500"> · {fmtPrice(e.price)}</span> : null}
                {e.notes ? <span className="font-medium text-slate-500"> · {e.notes}</span> : null}
              </span>
              <button type="button" onClick={() => removeEntryAt(idx)} className="text-rose-500 hover:text-rose-700" aria-label="إزالة">
                إزالة العلاج
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* نافذة السن — شبكة الحالات المصوّرة */}
      <Modal
        open={!!activeTooth}
        onClose={() => setActiveTooth(null)}
        title={`السن ${activeTooth || ''} · ${currentStateKey(activeTooth) || ''}`}
        subtitle={
          bridgeFor(activeTooth)
            ? `جزء من جسر من السن ${bridgeFor(activeTooth).teeth[0]} إلى ${bridgeFor(activeTooth).teeth[1]} — يُزال كوحدة واحدة`
            : (stagedByTooth[activeTooth] || []).length
            ? `علاجات اليوم: ${(stagedByTooth[activeTooth] || []).map((e) => e.treatment).join(' + ')}`
            : historyByTooth[activeTooth]
            ? `عولج سابقاً: ${historyByTooth[activeTooth].procedure}${
                historyByTooth[activeTooth]?.visit?.visit_date ? ` (${formatDateShort(historyByTooth[activeTooth].visit.visit_date)})` : ''
              }`
            : 'اختر حالة السن من الشبكة — أو علاجاً مفصّلاً بالأسعار من الأسفل'
        }
        footer={
          <div className="flex flex-wrap justify-start gap-2">
            {(stagedByTooth[activeTooth] || []).length > 0 && (
              <Button variant="dangerGhost" onClick={removeToothTreatments}>إزالة كل علاجات اليوم من هذا السن</Button>
            )}
            {persistHistory && historyByTooth[activeTooth] && (
              <Button variant="dangerGhost" loading={removingHistory} onClick={removeHistoryTooth}>
                إزالة علامة السن السابقة (بعد العلاج)
              </Button>
            )}
            <Button variant="secondary" onClick={() => setActiveTooth(null)}>إنهاء</Button>
          </div>
        }
      >
        {/* المستوى الأول: شبكة الحالات — أو المستوى الثاني: قائمة أنواع العلاج المختار */}
        {familyPick ? (
          <div>
            {/* رأس القائمة: اسم العلاج + عدد الأنواع + رجوع */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setFamilyPick(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-primary-400 hover:bg-primary-50"
              >
                <ArrowRight size={14} />
                رجوع
              </button>
              <p className="text-xs font-bold text-primary-900">
                انواع «{familyPick.def.key}» ({familyPick.types.length})
              </p>
            </div>

            {/* قائمة الأنواع — كل نوع بسعره ولونه، النقرة تُسعّره على السن */}
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {familyPick.types.map((p, i) => (
                <li key={(p.treatment || '') + i}>
                  <button
                    type="button"
                    onClick={() => {
                      applyTreatment(p)
                      setFamilyPick(null)
                      setActiveTooth(null)
                    }}
                    className="flex w-full items-center justify-between gap-3 bg-white px-3 py-2.5 text-start transition-colors hover:bg-primary-50"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-bold text-slate-800">{p.treatment}</span>
                      {Number(p.price) > 0 && <span className="text-[11px] font-semibold text-slate-400">{fmtPrice(p.price)}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-slate-200" style={{ background: p.color }} />
                      <span className="text-[11px] font-bold text-primary-500">اختيار</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-slate-400">
              الأنواع من «أسعاري» — يمكن تعديل الأسعار أو إضافة أنواع جديدة من صفحة أسعاري.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {STATE_DEFS.map((d) => {
              const selected = currentStateKey(activeTooth) === d.key
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => applyState(d)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 transition-colors ${
                    selected ? 'border-primary-600 bg-primary-50' : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50/40'
                  }`}
                >
                  <StateIcon def={d} size={30} active={selected} />
                  <span className={`text-[11px] font-bold ${selected ? 'text-primary-800' : 'text-slate-600'}`}>{d.key}</span>
                  {d.family && familyTypes(d.family).length > 1 && (
                    <span className="text-[8px] font-bold text-primary-400">{familyTypes(d.family).length} أنواع</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <Field label="ملاحظة على السن" className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const def = STATE_DEFS.find((d) => d.key === (currentStateKey(activeTooth) || 'أخرى'))
                if (def && def.treatment) applyState(def)
              }
            }}
            rows={2}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-primary-500"
            placeholder="ملاحظة على السن… (Enter للحفظ)"
          />
        </Field>

        {/* العلاجات المفصّلة بالأسعار */}
        {categories.length > 0 && (
          <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold text-slate-600">علاجات مفصّلة بالأسعار (من أسعاري)</summary>
            <div className="mt-2">
              <Field label="فئة التشخيص">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCat(c)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        cat === c ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-primary-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              {cat && (
                <Field label="يُضاف للسن ويُحسب سعره على الحساب" className="mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(pricebook || [])
                      .filter((p) => p.category === cat)
                      .map((p, i) => (
                        <button
                          key={(p.treatment || '') + i}
                          type="button"
                          onClick={() => applyTreatment(p)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary-400 hover:bg-primary-50"
                        >
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                          {p.treatment}
                          {Number(p.price) > 0 && <span className="text-[10px] text-slate-400">{fmtPrice(p.price)}</span>}
                        </button>
                      ))}
                  </div>
                </Field>
              )}
            </div>
          </details>
        )}
        {categories.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            لا توجد أسعار محفوظة — أضف فئات وعلاجات من صفحة «أسعاري» لتظهر هنا مع الحساب التلقائي
          </p>
        )}

        {/* علاجات اليوم على هذا السن */}
        {(stagedByTooth[activeTooth] || []).length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {(stagedByTooth[activeTooth] || []).map((e, idx) => {
              const globalIdx = entries.findIndex((x) => x === e)
              return (
                <li key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 font-bold text-primary-900">
                    <span className="inline-block h-3 w-3 rounded border" style={{ background: e.color, borderColor: e.color }} />
                    {e.treatment}
                    {e.price ? <span className="text-slate-500"> · {fmtPrice(e.price)}</span> : null}
                    {e.notes ? <span className="font-medium text-slate-500"> · {e.notes}</span> : null}
                  </span>
                  <button type="button" onClick={() => removeEntryAt(globalIdx)} className="text-rose-500 hover:text-rose-700">
                    إزالة
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>
    </div>
  )
}
