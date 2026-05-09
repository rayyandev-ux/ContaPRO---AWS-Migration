import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { config } from '../src/config.js';

async function main() {
  const app = Fastify();
  await app.register(jwt, { secret: config.jwtSecret });

  const userId = 'f29a0d33-92a1-4433-ac9e-896b1b44b106';
  const token = app.jwt.sign({ sub: userId });
  console.log('Generated token:', token);

  const expenseId = '152aa18e-7990-4c8c-805a-706e8c40d751';
  const url = `http://localhost:8080/api/expenses/${expenseId}`;

  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        cookie: `session=${token}`
      }
    });

    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Body:', text);
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

main();
