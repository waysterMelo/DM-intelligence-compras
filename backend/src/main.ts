import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// O Main.ts é o coração do servidor NestJS
// Ele inicia o Express (o motor de backend) e abre a porta 3000

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilita o CORS para que seu Frontend (React) consiga falar com este Backend
  // Sem isso, o navegador bloqueia as chamadas por segurança
  app.enableCors();
  
  // O servidor vai escutar na porta 3000
  // Para acessar as APIs, você usará http://localhost:3000/
  await app.listen(3000);
}
bootstrap();
