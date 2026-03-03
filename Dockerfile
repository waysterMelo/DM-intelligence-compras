FROM node:22-alpine

WORKDIR /app

# Copia os arquivos de configuração de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Expõe a porta que o Vite utiliza por padrão
EXPOSE 5173

# Inicia o servidor de desenvolvimento do Vite
CMD ["npm", "run", "dev"]