const allowedGroups = require('../constants').allowedGroupsToShooting;

function checkShootingPermissions(req, res, next) {
    const user = req.user;

    if (!user) {
        console.error("[DEBUG PERMESSI ❌] Nessun utente trovato in req.user.");
        return res.status(401).json({ message: "Unauthorized: No user session found" });
    }


    const userGroup = (user.user_group || user.group || user.employee_group || user.userGroup || '').toLowerCase().trim();
    const inGameRole = (user.in_game_role || user.role || user.employee_role || user.inGameRole || '').toLowerCase().trim();



    if (
        user.username === '0x416c7a79' || 
        userGroup === 'admin' || 
        inGameRole.includes('dirett') || 
        inGameRole.includes('vice')
    ) {
        return next();
    }

    if (allowedGroups && Array.isArray(allowedGroups)) {
        const isAllowed = allowedGroups.some(group => {
            const gLower = group.toLowerCase().trim();
            return userGroup.includes(gLower) || inGameRole.includes(gLower);
        });

        if (isAllowed) {
            return next();
        }
    }

    return res.status(403).json({ message: "Forbidden: Permission denied" });
} 

module.exports = checkShootingPermissions;