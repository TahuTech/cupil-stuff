FROM alpine:3.20

ARG PB_VERSION=0.40.3
# Diisi otomatis oleh Docker: amd64 (PC/laptop) atau arm64 (Raspberry Pi, mini PC ARM)
ARG TARGETARCH=amd64

RUN apk add --no-cache unzip ca-certificates tzdata

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

ENV TZ=Asia/Jakarta
EXPOSE 8090

# Migrasi di pb_migrations dijalankan otomatis saat serve.
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
