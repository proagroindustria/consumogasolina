const { Pool } = require('pg');
require('dotenv').config();

// BD Principal (empleados, departamentos, usuarios)
const bdPrincipal = new Pool({
    host: process.env.DB_PRINCIPAL_HOST,
    user: process.env.DB_PRINCIPAL_USER,
    password: process.env.DB_PRINCIPAL_PASSWORD,
    database: process.env.DB_PRINCIPAL_NAME,
    port: 5432,
});

// BD Gasolina (unidades, tarjetas, movimientos)
const bdGasolina = new Pool({
    host: process.env.DB_GASOLINA_HOST,
    user: process.env.DB_GASOLINA_USER,
    password: process.env.DB_GASOLINA_PASSWORD,
    database: process.env.DB_GASOLINA_NAME,
    port: 5432,
});

// Probar conexiones
bdPrincipal.connect((err) => {
    if (err) console.log('❌ Error BD Principal:', err.message);
    else console.log('✅ Conectado a BD Principal');
});

bdGasolina.connect((err) => {
    if (err) console.log('❌ Error BD Gasolina:', err.message);
    else console.log('✅ Conectado a BD Gasolina');
});

module.exports = { bdPrincipal, bdGasolina };