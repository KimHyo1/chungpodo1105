FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m copilot download-runtime
COPY app.py ai_runtime.py photo_analysis.py ./
COPY static ./static
ENV PORT=8080
ENV COPILOT_SKIP_CLI_DOWNLOAD=1
EXPOSE 8080
CMD ["python", "app.py"]
