const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

async function fixPassword() {
    const pool = new Pool({
        host: process.env.DB_PRINCIPAL_HOST,
        user: process.env.DB_PRINCIPAL_USER,
        password: process.env.DB_PRINCIPAL_PASSWORD,
        database: process.env.DB_PRINCIPAL_NAME,
    });
    
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);
    console.log('Nuevo hash:', hash);
    
    const result = await pool.query(`
        UPDATE usuarios 
        SET password_hash = $1 
        WHERE username = 'mhernandez'
        RETURNING id, username
    `, [hash]);
    
    if (result.rows.length > 0) {
        console.log(`✅ Contraseña actualizada para ${result.rows[0].username}`);
    } else {
        console.log('❌ Usuario no encontrado');
    }
    
    process.exit();
}

fixPassword();