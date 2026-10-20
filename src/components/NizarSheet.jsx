/**
 * ورقة المعاينة — عيادة د. نزار عبدالستار الشقرة
 * عرض ورقة المعاينة الأصلية (الصورة المختارة) فقط — بدون أي محتوى مكتوب فوقها.
 */
export default function NizarSheet({ paperImage = '/por.jpg' }) {
  return (
    <div className="prescription-sheet relative flex flex-col overflow-hidden bg-cover bg-center bg-no-repeat">
      <img
        src={paperImage}
        alt="ورقة المعاينة"
        className="block h-full w-full object-contain"
      />
    </div>
  )
}