FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

# Chapter audio is cached here; mount a volume to keep it across restarts.
ENV AUDIO_DIR=/app/audio-cache
RUN mkdir -p /app/audio-cache && chown node:node /app/audio-cache
USER node

EXPOSE 4000
# The schema is safe to re-run, so apply it on every start before the API comes up.
CMD ["sh", "-c", "node scripts/apply-schema.js && exec node src/server.js"]
