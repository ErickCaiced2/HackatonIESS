FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN useradd --create-home --uid 10001 app
WORKDIR /srv
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements.txt
ARG DEV=0
RUN if [ "$DEV" = "1" ]; then pip install -r requirements-dev.txt; fi
COPY . .
# La carpeta de claves pertenece al usuario sin privilegios; el volumen hereda ese dueño.
RUN mkdir -p /srv/claves && chown app:app /srv/claves && chmod 700 /srv/claves
USER app
EXPOSE 8000
ENTRYPOINT ["sh", "/srv/arranque.sh"]
