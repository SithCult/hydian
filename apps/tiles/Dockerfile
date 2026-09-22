# Static tile server: the in-game maps + icons, immutable cache headers, CORS.
# Built from a folder that holds the artwork next to the repository (the artwork is not in git), as the hosted
# tiles service. Redeploy only after a game patch.
FROM node:24-alpine
WORKDIR /srv
COPY serve.mjs NOTICE.txt ./
COPY icons ./icons
COPY maps  ./maps
USER node
EXPOSE 8080
CMD ["node", "serve.mjs"]
