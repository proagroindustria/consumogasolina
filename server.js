const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3003;  

console.log('📌 Puerto configurado:', PORT);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// =====================================================
// CONEXIONES A BASES DE DATOS
// =====================================================

const bdPrincipal = new Pool({
    host: process.env.DB_PRINCIPAL_HOST || 'localhost',
    user: process.env.DB_PRINCIPAL_USER || 'postgres',
    password: process.env.DB_PRINCIPAL_PASSWORD || '',
    database: process.env.DB_PRINCIPAL_NAME || 'bd_principal',
    port: 5432,
});

const bdGasolina = new Pool({
    host: process.env.DB_GASOLINA_HOST || 'localhost',
    user: process.env.DB_GASOLINA_USER || 'postgres',
    password: process.env.DB_GASOLINA_PASSWORD || '',
    database: process.env.DB_GASOLINA_NAME || 'bd_gasolina',
    port: 5432,
});

// Probar conexiones
bdPrincipal.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a BD Principal:', err.message);
    } else {
        console.log('✅ Conectado a BD Principal');
    }
});

bdGasolina.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a BD Gasolina:', err.message);
    } else {
        console.log('✅ Conectado a BD Gasolina');
    }
});

// =====================================================
// ENDPOINTS DE PRUEBA
// =====================================================

// Verificar conexión a BDs
app.get('/api/verificar-conexion', async (req, res) => {
    try {
        const testPrincipal = await bdPrincipal.query('SELECT 1 as connected');
        const testGasolina = await bdGasolina.query('SELECT 1 as connected');
        res.json({
            success: true,
            bd_principal: 'conectada',
            bd_gasolina: 'conectada',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});



// Obtener unidades reales
app.get('/api/unidades-reales', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, placas, marca, modelo, descripcion
            FROM unidades 
            WHERE activo = true
            LIMIT 10
        `);
        res.json({
            success: true,
            total: result.rows.length,
            unidades: result.rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const bcrypt = require('bcrypt');

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('🔐 Intento de login:', username);
    
    try {
        const result = await bdPrincipal.query(`
            SELECT 
                u.id,
                u.username,
                u.password_hash,
                u.empleado_id,
                e.trabajo_id,
                CONCAT(e.nombre, ' ', e.apellido_paterno, ' ', COALESCE(e.apellido_materno, '')) as nombre_completo
            FROM usuarios u
            JOIN empleados e ON u.empleado_id = e.id
            WHERE u.username = $1 AND u.activo = true
        `, [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        const usuario = result.rows[0];
        
        const passwordValido = await bcrypt.compare(password, usuario.password_hash);
        
        if (!passwordValido) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        res.json({
            success: true,
            token: 'token_temporal_' + Date.now(),
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre_completo,
                trabajo_id: usuario.trabajo_id
            }
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Test
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando', puerto: PORT });
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/abonos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'abonos.html'));
});





// =====================================================
// ENDPOINTS PARA LA APP (que usa abonos.js)
// =====================================================

// 1. Obtener UNIDADES (para el select)
app.get('/api/unidades', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, placas, marca, modelo, descripcion, tipo_unidad
            FROM unidades 
            WHERE activo = true
            ORDER BY tipo_unidad, placas NULLS LAST
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/unidades:', error);
        res.status(500).json({ error: 'Error al obtener unidades' });
    }
});

// 2. Obtener TARJETAS (para el select)
app.get('/api/tarjetas', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, numero, alias
            FROM tarjetas 
            WHERE activa = true
            ORDER BY id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/tarjetas:', error);
        res.status(500).json({ error: 'Error al obtener tarjetas' });
    }
});

app.get('/api/empleados', async (req, res) => {
    try {
        const result = await bdPrincipal.query(`
            SELECT 
                e.id,
                e.trabajo_id,
                CONCAT(e.nombre, ' ', e.apellido_paterno, ' ', COALESCE(e.apellido_materno, '')) as nombre_completo,
                e.puesto,
                e.departamento_id
            FROM empleados e
            WHERE e.activo = true
            ORDER BY e.nombre
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/empleados:', error);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
});

app.post('/api/movimientos', async (req, res) => {
    const { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion } = req.body;
    
    console.log('📝 Registrando movimiento:', { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto });
    
    try {
        const result = await bdGasolina.query(`
            INSERT INTO movimientos (fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [fecha, tarjeta_id, unidad_id || null, empleado_id || null, departamento_id || null, monto, observacion || 'normal']);
        
        // Actualizar presupuesto
        const mes = new Date(fecha).getMonth() + 1;
        const anio = new Date(fecha).getFullYear();
        
        await bdGasolina.query(`
            UPDATE presupuesto_global 
            SET monto_restante = monto_restante - $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE mes = $2 AND anio = $3
        `, [monto, mes, anio]);
        
        res.json({ success: true, id: result.rows[0].id });
        
    } catch (error) {
        console.error('Error en /api/movimientos:', error);
        res.status(500).json({ error: 'Error al registrar movimiento: ' + error.message });
    }
});

app.get('/api/movimientos', async (req, res) => {
    try {
        // Obtener movimientos
        const result = await bdGasolina.query(`
            SELECT m.*, 
                   t.numero as tarjeta_numero,
                   u.placas as unidad_placas,
                   u.descripcion as unidad_descripcion
            FROM movimientos m
            LEFT JOIN tarjetas t ON m.tarjeta_id = t.id
            LEFT JOIN unidades u ON m.unidad_id = u.id
            ORDER BY m.fecha DESC
            LIMIT 100
        `);
        
        const movimientos = result.rows;
        
        if (movimientos.length === 0) {
            return res.json([]);
        }
        
        // Obtener IDs únicos de empleados y departamentos
        const empleadosIds = [...new Set(movimientos.map(m => m.empleado_id).filter(id => id))];
        const deptosIds = [...new Set(movimientos.map(m => m.departamento_id).filter(id => id))];
        
        // Mapear nombres de empleados
        let empleadosMap = new Map();
        if (empleadosIds.length > 0) {
            const empleadosRes = await bdPrincipal.query(`
                SELECT id, CONCAT(nombre, ' ', apellido_paterno, ' ', COALESCE(apellido_materno, '')) as nombre_completo
                FROM empleados WHERE id = ANY($1::int[])
            `, [empleadosIds]);
            empleadosMap = new Map(empleadosRes.rows.map(e => [e.id, e.nombre_completo]));
        }
        
        // Mapear nombres de departamentos
        let deptosMap = new Map();
        if (deptosIds.length > 0) {
            const deptosRes = await bdPrincipal.query(`
                SELECT id, nombre FROM departamentos WHERE id = ANY($1::int[])
            `, [deptosIds]);
            deptosMap = new Map(deptosRes.rows.map(d => [d.id, d.nombre]));
        }
        
        // Enriquecer movimientos con nombres
        const movimientosEnriquecidos = movimientos.map(m => ({
            ...m,
            empleado_nombre: empleadosMap.get(m.empleado_id) || null,
            departamento_nombre: deptosMap.get(m.departamento_id) || null
        }));
        
        res.json(movimientosEnriquecidos);
        
    } catch (error) {
        console.error('Error en GET /api/movimientos:', error);
        res.status(500).json({ error: 'Error al obtener movimientos' });
    }
});

// DELETE movimiento
app.delete('/api/movimientos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Obtener el monto antes de eliminar
        const movimiento = await bdGasolina.query('SELECT monto, fecha FROM movimientos WHERE id = $1', [id]);
        if (movimiento.rows.length === 0) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        
        await bdGasolina.query('DELETE FROM movimientos WHERE id = $1', [id]);
        
        // Restaurar presupuesto
        const fecha = movimiento.rows[0].fecha;
        const mes = new Date(fecha).getMonth() + 1;
        const anio = new Date(fecha).getFullYear();
        const monto = movimiento.rows[0].monto;
        
        await bdGasolina.query(`
            UPDATE presupuesto_global 
            SET monto_restante = monto_restante + $1
            WHERE mes = $2 AND anio = $3
        `, [monto, mes, anio]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar movimiento' });
    }
});

// PUT movimiento (editar)
app.put('/api/movimientos/:id', async (req, res) => {
    const { id } = req.params;
    const { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion } = req.body;
    
    try {
        const result = await bdGasolina.query(`
            UPDATE movimientos 
            SET fecha = $1, tarjeta_id = $2, unidad_id = $3, empleado_id = $4, 
                departamento_id = $5, monto = $6, observacion = $7
            WHERE id = $8
            RETURNING id
        `, [fecha, tarjeta_id, unidad_id || null, empleado_id || null, departamento_id || null, monto, observacion, id]);
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar movimiento' });
    }
});

// Obtener DEPARTAMENTOS (para el select)
app.get('/api/departamentos', async (req, res) => {
    try {
        const result = await bdPrincipal.query(`
            SELECT id, nombre
            FROM departamentos
            WHERE activo = true
            ORDER BY nombre
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/departamentos:', error);
        res.status(500).json({ error: 'Error al obtener departamentos' });
    }
});

// 6. Obtener PRESUPUESTO ACTUAL
app.get('/api/presupuesto/actual', async (req, res) => {
    try {
        const ahora = new Date();
        const mes = ahora.getMonth() + 1;
        const anio = ahora.getFullYear();
        
        const result = await bdGasolina.query(`
            SELECT mes, anio, monto_inicial, monto_restante,
                   (monto_inicial - monto_restante) as gastado
            FROM presupuesto_global
            WHERE mes = $1 AND anio = $2
        `, [mes, anio]);
        
        if (result.rows.length === 0) {
            res.json({ mes, anio, monto_inicial: 0, monto_restante: 0, gastado: 0 });
        } else {
            res.json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error en /api/presupuesto/actual:', error);
        res.status(500).json({ error: 'Error al obtener presupuesto' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📝 Login: http://localhost:${PORT}/login.html`);
    console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
    console.log(`🔍 Verificar BD: http://localhost:${PORT}/api/verificar-conexion`);
});