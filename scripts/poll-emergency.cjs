const poll = async (topic) => {
  const r = await fetch('https://ntfy.sh/' + topic + '/json?poll=1');
  return (await r.text()).trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)).filter(l => l.event === 'message');
};
(async () => {
  for (const phone of ['0991112223', '0992223334']) {
    const msgs = await poll('pt-' + phone);
    const last = msgs[msgs.length - 1];
    console.log('pt-' + phone + ':', msgs.length, 'msgs | last title:', last ? JSON.stringify(last.title) : '-');
    if (last) console.log('   body:', (last.message || '').slice(0, 90));
  }
})().catch(e => console.log('ERR', e.message));
