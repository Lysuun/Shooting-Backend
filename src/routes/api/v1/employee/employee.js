const Router = require('express').Router();
const { db } = require('../../../../database/database');
const authenticateToken = require('../../../../middleware/auth'); 
const isAdmin = require('../../../../middleware/isAdmin');
const isManager = require('../../../../middleware/isManager');

Router.get('/list', authenticateToken, isAdmin, list);
Router.post('/promote', authenticateToken, isManager, promote);
Router.post('/fire', authenticateToken, isAdmin, fire); 
Router.get('/managers/list', authenticateToken, isManager, fetchEmployeesByRole);
Router.post('/addRevenue', authenticateToken, addRevenue);
Router.get('/teamRevenue', authenticateToken, isManager, fetchRevenueOfTeam);
Router.get('/monthlyRevenue', authenticateToken, isAdmin, getMonthlyTotalRevenue);
Router.get('/employeeRevenue', authenticateToken, getMonthlyEmployeeRevenue);

async function list(req, res) {
    try {   
        const result = await db.execute({
            sql: "SELECT id, username, mc_uuid, in_game_role, user_group FROM users"
        });
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching employee list:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function fire(req, res) {
    const { userId } = req.body;
    try {
        const result = await db.execute({
            sql: "DELETE FROM users WHERE id = ?",
            args: [userId]
        });
        return res.status(200).json({ message: 'Employee fired successfully' });
    } catch (error) {
        console.error('Error firing employee:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function promote(req, res) {
    const { userId, userGroup, inGameRole } = req.body;
    try {
        const result = await db.execute({
            sql: "UPDATE users SET user_group = ?, in_game_role = ? WHERE id = ?",
            args: [userGroup, inGameRole, userId]
        });
        return res.status(200).json({ message: 'Employee promoted successfully' });
    } catch (error) {
        console.error('Error promoting employee:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function fetchEmployeesByRole(req, res) {
    try {
        const panelGroup = req.user && req.user.employee_group ? req.user.employee_group.toLowerCase() : '';
        const managerRole = req.user && req.user.in_game_role ? req.user.in_game_role.toLowerCase() : '';
        
        let divisioneSelezionata = panelGroup === 'admin' ? (req.query.reparto || '') : managerRole;
        divisioneSelezionata = divisioneSelezionata.toLowerCase();

        let searchPattern = '';

        if (divisioneSelezionata.includes('skin')) {
          searchPattern = '%Skin Editor%';
        } else if (divisioneSelezionata.includes('grafic') || divisioneSelezionata.includes('grafico')) {
          searchPattern = '%Grafico%';
        } else if (divisioneSelezionata.includes('foto') || divisioneSelezionata.includes('fotografo')) {
          searchPattern = '%Fotografo%';
        } else {
          return res.status(200).json([]);
        }

        const result = await db.execute({
            sql: "SELECT id, username, mc_uuid, in_game_role, user_group FROM users WHERE in_game_role LIKE ?",
            args: [searchPattern]
        });
        
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching employees by role:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function fetchRevenueOfTeam(req, res) {
    try {
        const panelGroup = req.user && req.user.employee_group ? req.user.employee_group.toLowerCase() : '';
        const managerRole = req.user && req.user.in_game_role ? req.user.in_game_role.toLowerCase() : '';
        
        let divisioneSelezionata = panelGroup === 'admin' ? (req.query.reparto || '') : managerRole;
        divisioneSelezionata = divisioneSelezionata.toLowerCase();

        let searchPattern = '';

        if (divisioneSelezionata.includes('skin')) {
            searchPattern = 'skin';
        } else if (divisioneSelezionata.includes('grafic') || divisioneSelezionata.includes('grafico')) {
            searchPattern = 'design';
        } else if (divisioneSelezionata.includes('foto') || divisioneSelezionata.includes('fotografo')) {
            searchPattern = 'photo';
        } else {
            return res.status(200).json({ guadagno: 0, foto: 0 });
        }

        const result = await db.execute({
            sql: `
                SELECT 
                    SUM(import) as totale, 
                    COUNT(id) as totale_vendite 
                FROM payments 
                WHERE type LIKE ? 
                  AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')
            `,
            args: [searchPattern]
        });

        const guadagnoReale = result.rows && result.rows[0] && result.rows[0].totale ? parseFloat(result.rows[0].totale) : 0;
        const venditeReali = result.rows && result.rows[0] && result.rows[0].totale_vendite ? parseInt(result.rows[0].totale_vendite) : 0;

        return res.status(200).json({
            guadagno: guadagnoReale,
            foto: venditeReali,
            vendite: venditeReali
        });

    } catch (error) {
        console.error('Error fetching revenue of team:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMonthlyTotalRevenue(req, res) {
    try {        
        const result = await db.execute({
            sql: `
                SELECT import FROM payments
                WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')
            `
        });
        const totalRevenue = result.rows.reduce((total, payment) => total + (payment.import || 0), 0);
        const totalVendite = result.rows.length;
        return res.status(200).json({ totalRevenue, totalVendite });
    } catch (error) {
        console.error('Error fetching monthly total revenue:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function addRevenue(req, res) {
    const { importo, categoria, cliente, note } = req.body;
    try {
        await db.execute({
            sql: "INSERT INTO payments (type, executor, import, client, notes) VALUES (?, ?, ?, ?, ?)",
            args: [categoria, req.user.id, importo, cliente, note]
        });
        return res.status(200).json({ message: 'Revenue added successfully' });
    } catch (error) {
        console.error('Error adding revenue:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function getMonthlyEmployeeRevenue(req, res) {
    try {
        const employeeId = req.user.id;
        const result = await db.execute({
            sql: `
                SELECT import FROM payments
                WHERE executor = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')
            `,
            args: [employeeId]
        });
        const totalRevenue = result.rows.reduce((total, payment) => total + (payment.import || 0), 0);
        const totalVendite = result.rows.length;
        return res.status(200).json({ totalRevenue, totalVendite });
    } catch (error) {
        console.error('Error fetching monthly employee revenue:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = Router;