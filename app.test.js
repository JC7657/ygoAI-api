// app.test.js
import app from './src/server.js';
const requestModule = await import('supertest');
const request = requestModule.default;

describe('Pruebas básicas del servidor Backend', () => {
  it('Debería responder con estado 200 en la ruta de health check', async () => {
    const response = await request(app).get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'OK');
  });
});