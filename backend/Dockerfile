# Usamos node:20-slim (Debian 12 Bookworm)
FROM node:20-slim

# Instalamos OpenSSL 3 e o CA-Certificates, fundamentais para o Prisma engine
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências (Agora limpas sem o lixo da sua máquina local)
RUN npm install

# Copia o restante dos arquivos (O .dockerignore vai filtrar o resto)
COPY . .

# Gera o cliente do Prisma (Agora com os motores certos do binaryTargets)
RUN npx prisma generate

# Compila o código para JavaScript
RUN npm run build

# Expõe a porta 3000
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "run", "start:prod"]
