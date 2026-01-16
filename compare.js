const CL = window.CareerLensShared;

CL.initPing();

CL.$('#doCompare').addEventListener('click', async () => {
  const a = CL.$('#cmpA').value.trim();
  const b = CL.$('#cmpB').value.trim();
  const region = CL.$('#cmpRegion').value.trim() || 'global';
  if (!a || !b) return alert('Enter both roles.');
  const box = CL.$('#cmpOutput');
  box.innerHTML = '<div class="muted dynLoader"></div>';
  const stop = CL.startCycler(box.querySelector('.dynLoader'));
  let res;
  try {
    res = await CL.API.compare(a, b, region);
  } finally {
    stop();
  }
  if (!res || res.error) {
    CL.$('#cmpOutput').innerHTML = `<div class="err">${res?.error || 'Error'}</div>`;
    return;
  }
  const rows = (res.roles||[]).map(r => `
    <div class="card">
      <div><strong>${r.role}</strong></div>
      <div class="cols">
        <div><span class="muted">Salary</span><div>${r.salary_range||''}</div></div>
        <div><span class="muted">Growth</span><div>${r.demand_growth||''}</div></div>
        <div><span class="muted">Work-Life</span><div>${r.work_life_balance||''}</div></div>
        <div><span class="muted">Education</span><div>${r.education||''}</div></div>
        <div><span class="muted">Automation</span><div>${r.automation_risk_percent ?? '?'}%</div></div>
      </div>
      <div><span class="muted">Top Skills:</span> ${(r.top_skills||[]).join(', ')}</div>
    </div>`).join('');
  CL.$('#cmpOutput').innerHTML = rows + `<div class="muted" style="margin-top:6px">${res.summary||''}</div>`;
});

const q = CL.parseQuery();
if (q.a) CL.$('#cmpA').value = q.a;
if (q.b) CL.$('#cmpB').value = q.b;
if (q.region) CL.$('#cmpRegion').value = q.region;
