require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http'); // Importante per far girare Express come funzione su Netlify

const authRoutes = require('./routes/api/v1/auth/auth');
const shootingRoutes = require('./routes/api/v1/shooting/shooting');
const employeeRoutes = require('./routes/api/v1/employee/employee');

const app = express();

app.use(express.json());

const allowedOrigins = [
  'http://localhost:5173',
  'https://shootingfronten.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloccato da policy CORS: Dominio frontend non autorizzato.'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true 
}));

app.get('/api/v1/ping', (req, res) => {
  return res.status(200).send("pong");
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shooting', shootingRoutes);
app.use('/api/v1/employee', employeeRoutes);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
module.exports.handler = serverless(app);