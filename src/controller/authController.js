const { db } = require('../database/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function login(req, res) {
    const { username, password } = req.body;
    
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM users WHERE username = ?',
            args: [username]
        });

        if (result.rows.length > 0) {
            const user = result.rows[0];
            
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (isMatch) {
                const token = jwt.sign(
                    { 
                        id: user.id || user.uuid, 
                        username: user.username,
                        group: (user.user_group || 'employee').toLowerCase().trim(),
                        user_group: (user.user_group || 'employee').toLowerCase().trim(),
                        uuid: user.mc_uuid,
                        role: user.in_game_role,
                        in_game_role: user.in_game_role
                    }, 
                    process.env.JWT_SECRET || 'LA_TUA_CHIAVE_SEGRETA', 
                    { expiresIn: '8h' }
                );
                
                
                return res.status(200).json({ 
                    message: "Login Successful", 
                    id: user.id,
                    jwt: token,
                    user_group: user.user_group,
                    uuid: user.mc_uuid,
                    in_game_role: user.in_game_role
                });
            } else {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
        } else {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
}

async function register(req, res) {
    const { username, password, user_group, inGameRole, uuid: manualUuid } = req.body;

    try {
        const result = await db.execute({
            sql: "SELECT username FROM users WHERE username = ?",
            args: [username]
        });

        if (result.rows.length > 0) {
            return res.status(409).json({ message: "This username is already registered!" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        let finalUuid = manualUuid || "no-uuid";
        
        if (!manualUuid || manualUuid.trim() === "") {
            try {
                const apiResponse = await fetch(`https://api.ashcon.app/mojang/v2/user/${username}`);
                if (apiResponse.status === 200) {
                    const data = await apiResponse.json();
                    finalUuid = data.uuid || "no-uuid";
                } else {
                    console.warn("Couldn't find UUID for " + username);
                }
            } catch (apiErr) {
                console.error("Mojang API unreachable, using fallback uuid", apiErr);
            }
        }

        await db.execute({
            sql: "INSERT INTO users (username, password, mc_nick, mc_uuid, user_group, in_game_role) VALUES (?, ?, ?, ?, ?, ?)",
            args: [username, hashedPassword, username, finalUuid, user_group, inGameRole]
        });

        return res.status(201).json({ message: "User registered successfully" });

    } catch (err) {
        console.error("Registration error:", err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
}

module.exports = {
    login,
    register
};