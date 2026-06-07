FROM python:3-slim
RUN pip install fastapi uvicorn
COPY mock_jira.py /app/mock_jira.py
WORKDIR /app
EXPOSE 8080
CMD ["python", "mock_jira.py"]
