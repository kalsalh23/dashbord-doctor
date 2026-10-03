const fs = require('fs');
// 1) Schedule tabs: الكل (not-completed) / المنتهية (completed+cancelled+no_show) — remove قيد العمل
const sp = 'src/pages/doctor/Schedule.jsx';
let s = fs.readFileSync(sp, 'utf8');
s = s.replace("  const [filter, setFilter] = useState('patient') // patient = active queue, all, done", "  const [filter, setFilter] = useState('all') // all = active (not examined), done = completed/cancelled");
s = s.replace(
  `        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'patient', label: 'قيد العمل', count: counts.active },
            { value: 'all', label: 'الكل', count: counts.all },
            { value: 'done', label: 'المنتهية', count: counts.done },
          ]}
        />`,
  `        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'الكل', count: counts.all - counts.done },
            { value: 'done', label: 'المنتهية', count: counts.done },
          ]}
        />`
);
s = s.replace(
  `  const shown = useMemo(() => {
    let list = appts || []
    if (filter === 'patient') list = list.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status))
    if (filter === 'done') list = list.filter((a) => ['completed', 'cancelled', 'no_show'].includes(a.status))
    return [...list].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  }, [appts, filter])`,
  `  const shown = useMemo(() => {
    let list = appts || []
    if (filter === 'all') list = list.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status))
    if (filter === 'done') list = list.filter((a) => ['completed', 'cancelled', 'no_show'].includes(a.status))
    return [...list].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  }, [appts, filter])`
);
fs.writeFileSync(sp, s);
console.log('schedule tabs fixed');
