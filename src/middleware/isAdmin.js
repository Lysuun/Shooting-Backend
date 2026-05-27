function isAdmin(req, res, next) {
    const user = req.user;

    if (!user) {
        return res.status(401).json({ message: "Unauthorized: No user found" });
    }

    if (user.employee_group === 'admin') {
        return next();
    }

    return res.status(403).json({ message: "Forbidden: You don't have permission to access this resource" });
}

module.exports = isAdmin;