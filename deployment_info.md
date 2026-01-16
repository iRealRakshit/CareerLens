**CareerLens: AI-Powered Career Exploration and Planning**

CareerLens is a web application that uses AI to help users explore and plan their career paths. It provides a suite of tools for career discovery, market insights, and resume enhancement.

**Features:**

*   **Adaptive Career Fit Quiz:** A personalized quiz that recommends careers based on your interests and skills.
*   **Market Insight Dashboard:** Provides real-time data on job trends, salaries, and required skills.
*   **Smart Recommendations:** Generates personalized learning paths and resume suggestions.
*   **Career Comparison:** Allows you to compare two roles side-by-side.
*   **Resume & Portfolio Enhancer:** Analyzes your resume and provides suggestions for improvement.
*   **Growth Roadmap:** A gamified experience that helps you track your progress towards your dream job.

**Technologies:**

*   **Frontend:** HTML, CSS, JavaScript, D3.js
*   **Backend:** Python
*   **AI:** Groq, Ollama (llama3.1)

---

### Deployment Steps

To deploy this application, you will need to follow these general steps:

1.  **Choose a Hosting Provider:**
    *   For a Python web application like this (which includes a backend), you'll need a platform that supports running Python servers. Popular choices include:
        *   **Heroku:** Good for ease of use, especially for beginners.
        *   **AWS (Amazon Web Services) / Google Cloud Platform (GCP):** Highly scalable and powerful, suitable for more complex needs.
        *   **DigitalOcean:** Developer-friendly with clear pricing.
    *   **GitHub Pages is NOT suitable for the full application** because it only hosts static files (HTML, CSS, JavaScript) and cannot run your Python backend (`server.py`).

2.  **Prepare Your Application for Deployment:**
    *   **Create a `requirements.txt` file:** This file lists all the Python packages your application needs. Navigate to your project's root directory in the terminal and run:
        ```bash
        pip freeze > requirements.txt
        ```
    *   **Create a `Procfile` (for some providers like Heroku):** This file tells the hosting provider how to start your web server. For a simple Flask application, it often looks like this (you might need to install `gunicorn` first: `pip install gunicorn`):
        ```
        web: gunicorn server:app
        ```
        *Note: If your main Flask app instance is named differently (e.g., `app.py` and the instance is `my_app`), adjust `server:app` accordingly (e.g., `app:my_app`).*
    *   **Configure Environment Variables:** If your application uses any sensitive information (API keys, database credentials, etc.), these should be configured as environment variables on your hosting platform, not hardcoded in your public repository.

3.  **Deploy Your Application:**
    *   The exact deployment process depends heavily on your chosen hosting provider. Generally, it involves:
        *   **Creating a new application instance** on the provider's platform.
        *   **Connecting your project to a Git repository** (usually GitHub).
        *   **Pushing your code** to the linked repository to trigger a build and deployment.
    *   Refer to the specific documentation for your chosen provider. Here are some starting points:
        *   **Heroku Python Deployment:** [https://devcenter.heroku.com/articles/deploying-python](https://devcenter.heroku.com/articles/deploying-python)
        *   **AWS Elastic Beanstalk (Python):** [https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create-deploy-python-flask.html](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create-deploy-python-flask.html)
        *   **Google Cloud App Engine (Python):** [https://cloud.google.com/appengine/docs/standard/python3/building-app](https://cloud.google.com/appengine/docs/standard/python3/building-app)
        *   **DigitalOcean (Python with Gunicorn/Nginx):** [https://www.digitalocean.com/community/tutorials/how-to-deploy-python-web-applications-with-gunicorn-and-nginx-on-ubuntu-20-04](https://www.digitalocean.com/community/tutorials/how-to-deploy-python-web-applications-with-gunicorn-and-nginx-on-ubuntu-20-04)

4.  **Configure Your Domain Name (Optional):**
    *   If you have a custom domain name, you can configure it to point to your deployed application. This typically involves adding `CNAME` or `A` records in your domain registrar's DNS settings.

---

### Deploying Frontend on GitHub Pages (Backend will NOT work)

If you only want to showcase the static frontend of your application (without any AI functionality or backend server interaction), you can use GitHub Pages:

1.  **Create a `gh-pages` branch:** In your Git repository, create a new branch named `gh-pages`.
2.  **Move static files:** Copy all the files from your `static/` directory directly into the root of this `gh-pages` branch.
3.  **Commit and Push:** Commit these changes to the `gh-pages` branch and push it to GitHub.
4.  **Enable GitHub Pages:** Go to your GitHub repository settings, find the "Pages" section, and set the source branch to `gh-pages`. Your static site will then be accessible at `https://<your-username>.github.io/<your-repository-name>/`.
    *Remember: The AI features will not function with this deployment method.*