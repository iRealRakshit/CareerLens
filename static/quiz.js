const CL = window.CareerLensShared;
CL.initPing();

// Expanded question set (aim for 15–17 answers). No company-specific targeting.
// Dropdowns include an Other… option that reveals a text box.






function renderQuestion(q, questionNumber, value) {
  const wrap = document.createElement('div');
  wrap.className = 'q';
  const num = document.createElement('div');
  num.className = 'qnum';
  num.textContent = questionNumber; // Display the question number
  const label = document.createElement('label');
  label.textContent = q.text; // Main question text

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'quiz-options'; // Will add styling for this later

  // Render options as buttons
  if (q.options && q.options.length > 0) {
    q.options.forEach(optText => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option-btn';
      btn.textContent = optText;
      btn.onclick = () => {
        // Automatically select this option and set it as value
        const quizInput = document.getElementById('quizInput');
        quizInput.value = optText;
        // Optionally highlight the selected button
        document.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // If there's an 'other' input, hide it if an option is selected
        const quizOtherInput = document.getElementById('quizOtherInput');
        if (quizOtherInput) quizOtherInput.value = '';
      };
      optionsContainer.appendChild(btn);
    });
    wrap.appendChild(optionsContainer);
  }

  // Always include a text input for custom answers
  const otherInput = document.createElement('input');
  otherInput.type = 'text';
  otherInput.placeholder = q.options && q.options.length > 0 ? 'Or enter your own answer here...' : 'Enter your answer here...';
  otherInput.id = 'quizOtherInput';
  otherInput.className = 'quiz-custom-input';
  if (value) otherInput.value = value; // Pre-fill if value exists

  // Listener to deselect buttons if custom input is used
  otherInput.addEventListener('input', () => {
    document.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
    const quizInput = document.getElementById('quizInput');
    if (quizInput) quizInput.value = otherInput.value; // Keep hidden input updated
  });


  // Hidden input to store the actual value to be submitted
  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.id = 'quizInput'; // This ID will be used by getCurrentValue
  if (value) hiddenInput.value = value;

  wrap.appendChild(num);
  wrap.appendChild(label);
  wrap.appendChild(optionsContainer); // Add options container after label
  wrap.appendChild(otherInput); // Add custom input
  wrap.appendChild(hiddenInput); // Add hidden input

  // Initial selection if a value is present
  if (value) {
    const selectedBtn = Array.from(optionsContainer.querySelectorAll('.quiz-option-btn')).find(btn => btn.textContent === value);
    if (selectedBtn) {
      selectedBtn.classList.add('selected');
    } else {
      otherInput.value = value;
    }
  }

  return wrap;
}

function runAdaptiveQuiz() {
  const app = CL.$('#quizApp');
  const results = CL.$('#quizResults');
  const state = {
    conversationHistory: [], // To store AI and user messages for context
    currentQuestionNum: 0,
    answers: [], // Stores user's answers for final submission
    currentQuestion: null, // Stores the last question asked by AI
  };
  const MAX_QUESTIONS = 10;

  function updateUI(question) {
    app.innerHTML = ''; // Clear previous content

    if (!question && state.currentQuestionNum >= MAX_QUESTIONS) {
        return finish(); // Quiz is over
    }

    state.currentQuestion = question;

    const header = document.createElement('div');
    header.className = 'row';
    const progress = document.createElement('div');
    progress.className = 'muted';
    progress.textContent = `Question ${state.currentQuestionNum + 1} of ${MAX_QUESTIONS}`;
    header.appendChild(progress);

    const qEl = renderQuestion(question, state.currentQuestionNum + 1, ''); // Render with current question number
    app.appendChild(header);
    app.appendChild(qEl);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = (state.currentQuestionNum === MAX_QUESTIONS - 1) ? 'Submit Quiz' : 'Next Question';
    actions.appendChild(nextBtn);
    app.appendChild(actions);

    nextBtn.onclick = async () => {
      const answer = getCurrentValue();
      if (!answer) {
        CL.$('#quizOtherInput').focus(); // Focus on the custom input if empty
        return;
      }

      state.answers.push({ question: state.currentQuestion.text, answer: answer });
      state.conversationHistory.push({ role: 'user', content: answer });
      state.currentQuestionNum++;

      if (state.currentQuestionNum >= MAX_QUESTIONS) {
        return finish();
      }

      // Fetch next question from AI
      await fetchNextQuestion();
    };
  }

  function getCurrentValue() {
    const hiddenInput = CL.$('#quizInput');
    if (hiddenInput && hiddenInput.value) {
        return hiddenInput.value;
    }
    const customInput = CL.$('#quizOtherInput');
    return (customInput?.value || '').trim();
  }

  async function fetchNextQuestion() {
    results.innerHTML = '<div class="muted dynLoader"></div>';
    const stopLoader = CL.startCycler(results.querySelector('.dynLoader'));

    try {
      let response;
      if (state.currentQuestionNum === 0) {
        // First question
        response = await CL.API.adaptiveQuizStart();
      } else {
        // Subsequent questions
        response = await CL.API.adaptiveQuizNext(state.conversationHistory);
      }

      if (response && response.question) {
        state.conversationHistory.push({ role: 'assistant', content: response.question.text }); // Use only the question text
        updateUI(response.question);
      } else {
        throw new Error(response.error || 'Failed to get question from AI.');
      }
    } catch (e) {
      console.error('Error fetching question:', e);
      app.innerHTML = `<p class="err">Error: ${e.message}. Please refresh and try again.</p>`;
      results.innerHTML = '';
      CL.setStatus('AI Quiz Error', 'err');
    } finally {
      stopLoader();
    }
  }

  async function finish() {
    app.innerHTML = ''; // Clear quiz UI
    results.innerHTML = '<div class="muted dynLoader"></div>';
    const stopLoader = CL.startCycler(results.querySelector('.dynLoader'));

    try {
      // Send all collected answers to the original quiz analysis endpoint
      const formattedAnswers = state.answers.map(entry => `${entry.question}: ${entry.answer}`);
      const res = await CL.API.quiz(formattedAnswers);

      if (!res || !res.matches || !Array.isArray(res.matches) || res.matches.length === 0) {
        throw new Error('AI did not return valid career matches.');
      }

      const html = res.matches.map((m, idx) => {
        const conf = Math.round(m.confidence || 0);
        const role = encodeURIComponent(m.role || '');
        return `
          <div class="match">
            <h3>${idx + 1}. ${m.role} <span class="pill">${conf}% fit</span></h3>
            <div class="muted">${m.reasoning || ''}</div>
            <div class="meta" style="margin-top:6px;">
              <span class="pill">Personality: ${(m.personality_fit || []).join(', ')}</span>
              <span class="pill">Skills: ${(m.skills_fit || []).join(', ')}</span>
              <a class="pill" href="/insights?role=${role}">View Insights →</a>
            </div>
          </div>`;
      }).join('');
      results.innerHTML = html;
      CL.setStatus('Quiz Complete', 'ok');
    } catch (e) {
      console.error('Error finishing quiz:', e);
      results.innerHTML = `<p class="err">Error: ${e.message}. Could not finalize quiz results.</p>`;
      CL.setStatus('Quiz Finalization Error', 'err');
    } finally {
      stopLoader();
    }
  }

  // Kick off the quiz
  fetchNextQuestion();
}

runAdaptiveQuiz();
