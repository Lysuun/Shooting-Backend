require('dotenv').config();
const express = require('express');
const cors = require('cors')

const authRoutes = require('./routes/api/v1/auth/auth');
const shootingRoutes = require('./routes/api/v1/shooting/shooting');
const employeeRoutes = require('./routes/api/v1/employee/employee');

const app = express();


app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true 
}));


app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/shooting', shootingRoutes);

app.use('/api/v1/employee', employeeRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});