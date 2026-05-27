const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const token = req.headers['x-auth-token'];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');
        
        req.user = {
            id: decoded.id,
            username: decoded.username,
            employee_group: decoded.group || decoded.user_group || 'employee',
            uuid: decoded.uuid
        };

        next();
    } catch (error) {
        console.error("JWT verification failed:", error);
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
}

module.exports = authenticateToken;