FROM node:20-alpine

WORKDIR /app

# Sao chép package.json và cài đặt dependencies tối giản
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Sao chép mã nguồn backend
COPY . .

# Tạo thư mục uploads
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "server.js"]
