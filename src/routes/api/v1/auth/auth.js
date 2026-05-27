const Router = require('express').Router();

const { login, register } = require('../../../../controller/authController');
const isAdmin = require('../../../../middleware/isAdmin');
const authenticateToken = require('../../../../middleware/auth');
Router.post('/login', login);
Router.post('/register', authenticateToken, isAdmin, register);



module.exports = Router;
