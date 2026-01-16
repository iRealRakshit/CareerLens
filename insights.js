const CL = window.CareerLensShared;

CL.initPing();

CL.$('#loadInsights').addEventListener('click', async () => {
  const role = CL.$('#insightRole').value.trim();
  const region = CL.$('#insightRegion').value.trim() || 'global';
  if (!role) return alert('Enter a role.');
  const box = CL.$('#insightOutput');
  box.innerHTML = '<div class="muted dynLoader"></div>';
  const stop = CL.startCycler(box.querySelector('.dynLoader'));
  let res;
  try {
    res = await CL.API.market(role, region);
  } finally {
    stop();
  }
  if (!res || res.error) {
    CL.$('#insightOutput').innerHTML = `<div class="err">${res?.error || 'Error'}</div>`;
    return;
  }
  let years = res?.demand_trend?.years || [];
  let idxs = res?.demand_trend?.demand_index || [];
  // Ensure ascending order by year to avoid demotivating downward trends due to reversed data
  if (years.length === idxs.length && years.length > 1) {
    const pairs = years.map((y, i) => [Number(y), Number(idxs[i])]);
    pairs.sort((a, b) => (a[0] === b[0] ? 0 : a[0] - b[0]));
    years = pairs.map(p => p[0]);
    idxs = pairs.map(p => p[1]);
  }
  CL.drawLineChart(CL.$('#trendChart'), years, idxs, `${res.role} Demand Index`);

  const sal = res?.salary_by_region || [];
  CL.drawBarChart(CL.$('#salaryChart'), sal.map(s=>s.region), sal.map(s=>s.avg_salary), 'Average Salary');

  const html = `
    <div class="cols">
      <div><strong>Role</strong><div class="muted">${res.role} • ${res.region}</div></div>
      <div><strong>Top Skills</strong><ul class="list">${(res.top_skills||[]).map(s=>`<li>${s}</li>`).join('')}</ul></div>
      <div><strong>Forecast</strong><div class="muted">${res.growth_forecast?.five_year_outlook || ''}</div><div class="muted">Automation Risk: ${res.growth_forecast?.automation_risk_percent ?? '?'}%</div></div>
    </div>
    <div style="margin-top:8px" class="muted">${res.growth_forecast?.notes || ''}</div>
  `;
  CL.$('#insightOutput').innerHTML = html;
});

// Prefill from query
const q = CL.parseQuery();
if (q.role) {
  CL.$('#insightRole').value = q.role;
  if (q.region) CL.$('#insightRegion').value = q.region;
  CL.$('#loadInsights').click();
}
