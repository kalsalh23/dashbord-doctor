// كل اختصاصات الأطباء المتوفرة في دليل طبي — لكل اختصاص لوحته وحقوله الخاصة
// key يطابق profiles.specialty_key

export const SPECIALTIES = [
  {
    key: 'general', label: 'طب عام', icon: 'Activity',
  },
  {
    key: 'dentistry', label: 'طب الأسنان', icon: 'SmilePlus',
    examLabel: 'الفحص الفمي',
    chart: 'dental',
    fields: [
      { key: 'anesthesia', label: 'نوع التخدير' },
      { key: 'materials', label: 'المواد المستخدمة' },
      { key: 'next_session', label: 'الجلسة القادمة' },
    ],
  },
  {
    key: 'peds', label: 'طب الأطفال', icon: 'Baby',
    examLabel: 'الفحص السريري للأطفال',
    fields: [
      { key: 'weight', label: 'الوزن (كغ)' },
      { key: 'height', label: 'الطول (سم)' },
      { key: 'temperature', label: 'الحرارة' },
      { key: 'growth', label: 'ملاحظات النمو والتطور' },
    ],
  },
  {
    key: 'obgyn', label: 'نساء وتوليد', icon: 'Heart',
    fields: [
      { key: 'pregnancy_week', label: 'أسبوع الحمل' },
      { key: 'gravidity', label: 'عدد الحمول والولادات' },
      { key: 'blood_pressure', label: 'ضغط الدم' },
      { key: 'ultrasound', label: 'ملاحظات السونار' },
    ],
  },
  {
    key: 'cardio', label: 'أمراض القلب', icon: 'HeartPulse',
    fields: [
      { key: 'blood_pressure', label: 'ضغط الدم' },
      { key: 'pulse', label: 'النبض' },
      { key: 'ecg', label: 'تخطيط القلب ECG' },
      { key: 'echo', label: 'الإيكو' },
    ],
  },
  {
    key: 'neuro', label: 'الأعصاب', icon: 'Brain',
    examLabel: 'الفحص العصبي',
    fields: [
      { key: 'consciousness', label: 'حالة الوعي (GCS)' },
      { key: 'muscle_power', label: 'قوة العضلات' },
      { key: 'reflexes', label: 'ردود الفعل' },
      { key: 'imaging', label: 'التصوير (CT/MRI)' },
    ],
  },
  {
    key: 'derma', label: 'الجلدية', icon: 'Sparkles',
    fields: [
      { key: 'lesion_site', label: 'موقع الإصابة' },
      { key: 'lesion_type', label: 'نوع الآفة الجلدية' },
      { key: 'lesion_size', label: 'الحجم/الانتشار' },
    ],
  },
  {
    key: 'ortho', label: 'جراحة العظام', icon: 'Bone',
    fields: [
      { key: 'joint', label: 'المفصل/العضو المصاب' },
      { key: 'range_of_motion', label: 'مدى الحركة' },
      { key: 'xray', label: 'الصورة الشعاعية' },
    ],
  },
  {
    key: 'ent', label: 'الأنف والأذن والحنجرة', icon: 'Ear',
    fields: [
      { key: 'side', label: 'الجانب المصاب' },
      { key: 'hearing', label: 'حالة السمع' },
      { key: 'endoscopy', label: 'المنظار' },
    ],
  },
  {
    key: 'internal', label: 'الباطنية', icon: 'Stethoscope',
    fields: [
      { key: 'blood_pressure', label: 'ضغط الدم' },
      { key: 'blood_sugar', label: 'سكر الدم' },
      { key: 'temperature', label: 'الحرارة' },
    ],
  },
  {
    key: 'chest', label: 'الصدر والتنفسية', icon: 'Wind',
    fields: [
      { key: 'spo2', label: 'تشبع الأوكسجين SpO2' },
      { key: 'spirometry', label: 'وظائف التنفس' },
      { key: 'xray', label: 'صورة الصدر' },
    ],
  },
  {
    key: 'gi', label: 'الجهاز الهضمي والكبد', icon: 'Utensils',
    fields: [
      { key: 'abdominal_exam', label: 'فحص البطن' },
      { key: 'endoscopy', label: 'المنظار (قولون/معدة)' },
      { key: 'liver_tests', label: 'وظائف الكبد' },
    ],
  },
  {
    key: 'urology', label: 'المسالك البولية', icon: 'Droplets',
    fields: [
      { key: 'urine_analysis', label: 'تحليل البول' },
      { key: 'ultrasound', label: 'سونار الكلى والمسالك' },
      { key: 'creatinine', label: 'الكرياتينين' },
    ],
  },
  {
    key: 'kidney', label: 'الكلى', icon: 'Droplets',
    fields: [
      { key: 'creatinine', label: 'الكرياتينين' },
      { key: 'dialysis_sessions', label: 'جلسات الغسيل الكلوي' },
      { key: 'urine_output', label: 'الإدرار' },
    ],
  },
  {
    key: 'endocrine', label: 'الغدد الصماء والسكري', icon: 'Droplet',
    fields: [
      { key: 'hba1c', label: 'السكر التراكمي HbA1c' },
      { key: 'fasting_sugar', label: 'السكر الصائم' },
      { key: 'thyroid', label: 'وظائف الغدة الدرقية' },
    ],
  },
  {
    key: 'psychiatry', label: 'الطب النفسي', icon: 'Brain',
    examLabel: 'تقييم الحالة النفسية',
    fields: [
      { key: 'mental_status', label: 'الحالة العقلية' },
      { key: 'sleep_appetite', label: 'النوم والشهية' },
      { key: 'risk_assessment', label: 'تقييم الخطورة' },
    ],
  },
  {
    key: 'ophthalmology', label: 'طب وجراحة العيون', icon: 'Eye',
    fields: [
      { key: 'visual_acuity', label: 'حدة البصر' },
      { key: 'eye_pressure', label: 'ضغط العين' },
      { key: 'fundus', label: 'قاع العين' },
    ],
  },
  {
    key: 'oncology', label: 'الأورام', icon: 'Ribbon',
    fields: [
      { key: 'stage', label: 'مرحلة الورم' },
      { key: 'biopsy', label: 'نتيجة الخزعة' },
      { key: 'chemo_sessions', label: 'جلسات العلاج الكيميائي' },
    ],
  },
  {
    key: 'family', label: 'طب الأسرة', icon: 'Users',
  },
  {
    key: 'emergency', label: 'طب الطوارئ', icon: 'Ambulance',
    fields: [
      { key: 'arrival_condition', label: 'حالة الوصول' },
      { key: 'vitals', label: 'العلامات الحيوية' },
      { key: 'intervention', label: 'التدخل الفوري' },
    ],
  },
  {
    key: 'physio', label: 'العلاج الطبيعي', icon: 'Accessibility',
    fields: [
      { key: 'session_no', label: 'رقم الجلسة' },
      { key: 'exercises', label: 'التمارين الموصوفة' },
      { key: 'progress', label: 'مدى التحسن' },
    ],
  },
  {
    key: 'speech', label: 'التخاطب وتواصل', icon: 'MessageCircle',
    fields: [
      { key: 'session_no', label: 'رقم الجلسة' },
      { key: 'progress', label: 'مدى التحسن' },
      { key: 'homework', label: 'تمارين منزلية' },
    ],
  },
  {
    key: 'nutrition', label: 'التغذية والعلاج الغذائي', icon: 'Salad',
    fields: [
      { key: 'weight', label: 'الوزن (كغ)' },
      { key: 'bmi', label: 'مؤشر كتلة الجسم BMI' },
      { key: 'diet_plan', label: 'النظام الغذائي' },
    ],
  },
]

export const specialtyLabel = (key) =>
  SPECIALTIES.find((s) => s.key === key)?.label || key || 'طب عام'

export const specialtyByKey = (key) =>
  SPECIALTIES.find((s) => s.key === key) || SPECIALTIES[0]
