FROM golang:1.25-bookworm AS go-build
ENV CGO_ENABLED=0 GOMAXPROCS=2
WORKDIR /src

FROM go-build AS server-build
RUN git clone --depth 1 --branch RELEASE.2025-10-15T17-29-55Z https://github.com/minio/minio.git .
RUN go build -trimpath -ldflags "$(go run buildscripts/gen-ldflags.go)" -o /go/bin/minio . && /go/bin/minio --version

FROM debian:bookworm-slim AS object-server
COPY --from=server-build /go/bin/minio /usr/local/bin/minio
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data"]

FROM go-build AS client
RUN git clone --depth 1 --branch RELEASE.2025-08-13T08-35-41Z https://github.com/minio/mc.git .
RUN go build -trimpath -ldflags "$(go run buildscripts/gen-ldflags.go)" -o /go/bin/mc . && /go/bin/mc --version

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS gallery
WORKDIR /app
COPY --from=client /go/bin/mc /usr/local/bin/mc
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node","server/index.js"]
