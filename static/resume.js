const CL = window.CareerLensShared;

CL.initPing();

CL.$('#resFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const text = await CL.readFileAsText(file, ext);
  const prev = CL.$('#resText').value.trim();
  CL.$('#resText').value = prev ? (prev + '\n\n' + text) : text;
  // Soft fallback note if nothing could be read
  if (ext === 'pdf' && (!text || text.length < 10)) {
    CL.$('#resOutput').innerHTML = '<div class="warn">Could not read text from this PDF. Trying again with enhanced parser…</div>';
  }
});

CL.$('#analyzeResume').addEventListener('click', async () => {
  const resume_text = CL.$('#resText').value.trim();
  const target_role = CL.$('#resRole').value.trim();
  const job_description = CL.$('#resJD').value.trim();
  if (!resume_text) return alert('Please upload your resume file or paste its text.');
  const box = CL.$('#resOutput');
  box.innerHTML = '<div class="muted dynLoader"></div>';
  const stop = CL.startCycler(box.querySelector('.dynLoader'));
  let res;
  try {
    res = await CL.API.analyzeResume(resume_text, target_role, job_description);
  } finally {
    stop();
  }
  if (!res || res.error) {
    CL.$('#resOutput').innerHTML = `<div class="err">${res?.error || 'Error'}</div>`;
    return;
  }
  const html = `
    <div class="cols">
      <div><strong>ATS Score</strong><div class="pill">${res.ats_score_percent ?? '?'}%</div></div>
      <div><strong>Target Role</strong><div class="muted">${res.target_role||''}</div></div>
    </div>
    <div style="margin-top:8px"><strong>Missing Keywords</strong>
      <ul class="list">${(res.missing_keywords||[]).map(k=>`<li>${k}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:8px"><strong>Section Feedback</strong>
      <ul class="list">
        <li><em>Summary:</em> ${res.sections_feedback?.summary||''}</li>
        <li><em>Experience:</em> ${res.sections_feedback?.experience||''}</li>
        <li><em>Skills:</em> ${res.sections_feedback?.skills||''}</li>
        <li><em>Education:</em> ${res.sections_feedback?.education||''}</li>
      </ul>
    </div>
    <div style="margin-top:8px"><strong>Improve Your Bullets</strong>
      <ul class="list">${(res.bullet_improvements||[]).map(t=>`<li>${t}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:8px"><strong>Projects to Add</strong>
      <ul class="list">${(res.suggested_projects||[]).map(t=>`<li>${t}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:8px"><strong>Certifications</strong>
      <ul class="list">${(res.certification_suggestions||[]).map(t=>`<li>${t}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:8px"><strong>Suggested Jobs (from your resume)</strong>
      <ul class="list">${(res.job_suggestions||[]).map(j=>{
        const role = encodeURIComponent(j?.title || '');
        const why = j?.why_fit || '';
        const lvl = j?.level ? ` <span class=\"pill\">${j.level}</span>` : '';
        return `<li><strong>${j?.title||''}</strong>${lvl} — <span class=\"muted\">${why}</span> <a class=\"pill\" href=\"/insights?role=${role}\">View Insights →</a></li>`;
      }).join('')}</ul>
    </div>
  `;
  CL.$('#resOutput').innerHTML = html;
});
