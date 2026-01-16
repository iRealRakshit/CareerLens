const CL = window.CareerLensShared;

const growJobInput = CL.$('#growJob');
const growWeeksSelect = CL.$('#growWeeks');
const growGenButton = CL.$('#growGen');
const resetRoadmapButton = CL.$('#resetRoadmap');
const growProgressDiv = CL.$('#growProgress');
const growTextStatusDiv = CL.$('#growTextStatus');
const growBarDiv = CL.$('#growBar');
const growPctDiv = CL.$('#growPct');
const growOutputDiv = CL.$('#growOutput');
const treeContainer = CL.$('#treeContainer');

let currentRoadmap = null;
let completedTasks = 0;
let totalTasks = 0;

// Function to save progress to local storage
function saveProgress() {
  localStorage.setItem('growProgress', JSON.stringify({
    job: growJobInput.value,
    weeks: growWeeksSelect.value,
    completedTasks: completedTasks,
    totalTasks: totalTasks, // Store totalTasks as well
    roadmap: currentRoadmap
  }));
}

// Function to load progress from local storage
function loadProgress() {
  const saved = localStorage.getItem('growProgress');
  if (saved) {
    const data = JSON.parse(saved);
    growJobInput.value = data.job;
    growWeeksSelect.value = data.weeks;
    currentRoadmap = data.roadmap;
    // Recalculate totalTasks from loaded roadmap
    totalTasks = data.totalTasks || (currentRoadmap ? currentRoadmap.weeks.reduce((sum, week) => sum + week.skills.length, 0) : 0);
    // Recalculate completedTasks from loaded roadmap
    completedTasks = data.completedTasks || (currentRoadmap ? currentRoadmap.weeks.reduce((sum, week) => sum + week.skills.filter(s => s.completed).length, 0) : 0);

    if (currentRoadmap) {
      growProgressDiv.style.display = 'block';
      renderRoadmap(currentRoadmap);
      updateGrowUI();
    }
  }
}

// Function to update the UI elements based on progress
function updateGrowUI() {
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
  growBarDiv.style.width = `${progress * 100}%`;
  growPctDiv.textContent = `${completedTasks}/${totalTasks} tasks completed (${Math.round(progress * 100)}%)`;
  growTextStatusDiv.textContent = 'Keep growing your career tree!';

  if (completedTasks >= totalTasks && totalTasks > 0) {
    growTextStatusDiv.textContent = `Roadmap complete! Your career tree is fully grown!`;
  }
  
  if (window.CareerLensTree && typeof window.CareerLensTree.render === 'function') {
    window.CareerLensTree.render(completedTasks, totalTasks);
  }
  
  saveProgress();
}

// Function to render the generated roadmap with checkboxes
function renderRoadmap(roadmap) {
  if (!roadmap || !roadmap.weeks) {
    growOutputDiv.innerHTML = '<p class="err">Failed to generate a valid roadmap.</p>';
    return;
  }

  let html = `<h3>Roadmap for ${roadmap.job || growJobInput.value}</h3>`;
  totalTasks = 0; // Reset total tasks before rendering for re-calculation
  roadmap.weeks.forEach((week, weekIndex) => {
    html += `
      <div class="roadmap-week">
        <h4>Week ${week.week}: ${week.focus_description}</h4>
        <ul>`;
    week.skills.forEach((skillItem, skillIndex) => {
      // skillItem should already be { name: string, completed: boolean }
      const uniqueId = `week-${weekIndex}-skill-${skillIndex}`;
      html += `
        <li class="task-item ${skillItem.completed ? 'completed' : ''}" data-week="${weekIndex}" data-skill="${skillIndex}">
          <input type="checkbox" id="${uniqueId}" ${skillItem.completed ? 'checked' : ''}>
          <label for="${uniqueId}">${skillItem.name}</label>
        </li>`;
      totalTasks++;
    });
    html += `</ul></div>`;
  });
  growOutputDiv.innerHTML = html;

  // Add event listeners to new checkboxes
  growOutputDiv.querySelectorAll('.task-item input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', (event) => {
      const listItem = event.target.closest('.task-item');
      const weekIndex = parseInt(listItem.dataset.week, 10);
      const skillIndex = parseInt(listItem.dataset.skill, 10);

      if (currentRoadmap && currentRoadmap.weeks[weekIndex] && currentRoadmap.weeks[weekIndex].skills[skillIndex]) {
        currentRoadmap.weeks[weekIndex].skills[skillIndex].completed = event.target.checked;
      }
      
      completedTasks = currentRoadmap.weeks.reduce((sum, week) =>
        sum + week.skills.filter(s => s.completed).length, 0
      );

      // Toggle 'completed' class on listItem
      if (event.target.checked) {
        listItem.classList.add('completed');
      } else {
        listItem.classList.remove('completed');
      }

      updateGrowUI();
    });
  });
  
  
}

// Event Listeners
growGenButton.onclick = async () => {
  const job = growJobInput.value.trim();
  const weeks = parseInt(growWeeksSelect.value, 10);
  if (!job) {
    alert('Please enter your dream job.');
    return;
  }

  growGenButton.disabled = true;
  resetRoadmapButton.disabled = true;
  growProgressDiv.style.display = 'none';
  growOutputDiv.innerHTML = '<div class="muted dynLoader"></div>';
  const stopLoader = CL.startCycler(growOutputDiv.querySelector('.dynLoader'));

  try {
    const res = await CL.API.roadmap(job, weeks);
    stopLoader();
    growGenButton.disabled = false;
    resetRoadmapButton.disabled = false;

    if (res && res.weeks) {
      // Initialize completed status for each skill
      res.weeks.forEach(week => {
          week.skills = week.skills.map(skill => ({ name: skill, completed: false }));
      });
      currentRoadmap = res;
      completedTasks = 0; // Reset completed tasks for new roadmap
      totalTasks = 0;
      
      growProgressDiv.style.display = 'block';
      renderRoadmap(currentRoadmap);
      updateGrowUI();
    } else {
      growOutputDiv.innerHTML = `<p class="err">Error: ${res.error || 'Failed to generate roadmap.'}</p>`;
    }
  } catch (e) {
    stopLoader();
    growGenButton.disabled = false;
    resetRoadmapButton.disabled = false;
    growOutputDiv.innerHTML = `<p class="err">Error: ${e.message}. Failed to generate roadmap.</p>`;
    console.error('Error generating roadmap:', e);
  }
};

resetRoadmapButton.onclick = () => {
  if (confirm('Are you sure you want to reset your entire roadmap and progress?')) {
    completedTasks = 0;
    totalTasks = 0;
    currentRoadmap = null;
    growProgressDiv.style.display = 'none';
    growOutputDiv.innerHTML = '';
    growJobInput.value = '';
    growWeeksSelect.value = '10'; growJobInput.value = '';
    saveProgress(); saveProgress();
    updateGrowUI(); // Reset tree to initial state (will have 0/0 tasks)
  }
};

// Initial load
CL.initPing(); // Call initPing once on page load
loadProgress();