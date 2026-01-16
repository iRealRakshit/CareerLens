const CL = window.CareerLensShared;

CL.initPing();

CL.$('#genRecommendations').addEventListener('click', async () => {
  const role = CL.$('#recRole').value.trim();
  const background = CL.$('#recBackground').value.trim();
  const weeks = parseInt(CL.$('#recWeeks').value || '8', 10);
  if (!role) return alert('Enter a target role.');
  const box = CL.$('#recOutput');
  box.innerHTML = '<div class="muted dynLoader"></div>';
  const stop = CL.startCycler(box.querySelector('.dynLoader'));
  let res;
  try {
    res = await CL.API.recommend(role, background, weeks);
  } finally {
    stop();
  }
  if (!res || res.error) {
    CL.$('#recOutput').innerHTML = `<div class="err">${res?.error || 'Error'}</div>`;
    return;
  }
  const html = `
    <div><strong>Learning Paths</strong>
      <ul class="list">${(res.learning_paths||[]).map(lp=>`<li>${lp.title}: ${(lp.resources||[]).map(r=>`<a href="${r.url}" target="_blank" rel="noopener">${r.name}</a>`).join(', ')}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:8px"><strong>Roadmap (${(res.roadmap_weeks||[]).length} weeks)</strong>
      <ul class="list">${(res.roadmap_weeks||[]).map(w=>`<li>Week ${w.week}: ${w.focus} — ${(w.outcomes||[]).join('; ')}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:8px"><strong>Resume Tips</strong>
      <ul class="list">${(res.resume_tips||[]).map(t=>`<li>${t}</li>`).join('')}</ul>
    </div>
  `;
  CL.$('#recOutput').innerHTML = html;
});

// Prefill from query if any
const q = CL.parseQuery();
if (q.role) CL.$('#recRole').value = q.role;

