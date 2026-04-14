const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { bdPrincipal, bdGasolina } = require('./database');

const router = express.Router();

// =====================================================
// MIDDLEWARE PARA VERIFICAR TOKEN
// =====================================================
function verificarToken(req, res, next) {
    const token = req.headers['authorization'];
    
    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }
    
    try {
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// =====================================================
// 1. LOGIN
// =====================================================
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Buscar usuario
        const result = await bdPrincipal.query(`
            SELECT u.id, u.username, u.password_hash, u.empleado_id, 
                   e.nombre_completo
            FROM usuarios u
            JOIN empleados e ON u.empleado_id = e.id
            WHERE u.username = $1 AND u.activo = true
        `, [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        const usuario = result.rows[0];
        
        // Verificar contraseña
        const valido = await bcrypt.compare(password, usuario.password_hash);
        
        if (!valido) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        // Generar token
        const token = jwt.sign(
            { 
                id: usuario.id, 
                empleado_id: usuario.empleado_id,
                nombre: usuario.nombre_completo 
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        res.json({ 
            success: true, 
            token, 
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre_completo
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// =====================================================
// 2. OBTENER UNIDADES (para el select)
// =====================================================
router.get('/unidades', verificarToken, async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, placas, marca, modelo, descripcion, tipo_unidad
            FROM unidades
            WHERE activo = true
            ORDER BY tipo_unidad, placas NULLS LAST
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener unidades' });
    }
});

// =====================================================
// 3. OBTENER TARJETAS (para el select)
// =====================================================
router.get('/tarjetas', verificarToken, async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, numero, alias
            FROM tarjetas
            WHERE activa = true
            ORDER BY id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener tarjetas' });
    }
});

// =====================================================
// 4. OBTENER EMPLEADOS (conductores)
// =====================================================
router.get('/empleados', verificarToken, async (req, res) => {
    try {
        const result = await bdPrincipal.query(`
            SELECT id, nombre_completo
            FROM vw_empleados
            WHERE activo = true AND puesto ILIKE '%conductor%' OR puesto ILIKE '%chofer%'
            ORDER BY nombre_completo
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
});

// =====================================================
// 5. REGISTRAR MOVIMIENTO (abono)
// =====================================================
router.post('/movimientos', verificarToken, async (req, res) => {
    const { fecha, tarjeta_id, unidad_id, empleado_id, monto, observacion, categoria } = req.body;
    
    try {
        // Insertar movimiento
        const result = await bdGasolina.query(`
            INSERT INTO movimientos (fecha, tarjeta_id, unidad_id, empleado_id, monto, observacion, categoria, usuario_registra_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [fecha, tarjeta_id, unidad_id || null, empleado_id || null, monto, observacion, categoria || 'normal', req.usuario.id]);
        
        // Descontar del presupuesto del mes
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
        console.error(error);
        res.status(500).json({ error: 'Error al registrar movimiento' });
    }
});

// =====================================================
// 6. OBTENER MOVIMIENTOS (con filtros)
// =====================================================
router.get('/movimientos', verificarToken, async (req, res) => {
    const { fecha_inicio, fecha_fin, unidad_id } = req.query;
    
    try {
        let query = `
            SELECT m.*, 
                   t.numero as tarjeta_numero,
                   u.placas as unidad_placas,
                   u.descripcion as unidad_descripcion
            FROM movimientos m
            LEFT JOIN tarjetas t ON m.tarjeta_id = t.id
            LEFT JOIN unidades u ON m.unidad_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (fecha_inicio) {
            query += ` AND m.fecha >= $${paramIndex}`;
            params.push(fecha_inicio);
            paramIndex++;
        }
        
        if (fecha_fin) {
            query += ` AND m.fecha <= $${paramIndex}`;
            params.push(fecha_fin);
            paramIndex++;
        }
        
        if (unidad_id) {
            query += ` AND m.unidad_id = $${paramIndex}`;
            params.push(unidad_id);
            paramIndex++;
        }
        
        query += ` ORDER BY m.fecha DESC LIMIT 100`;
        
        const result = await bdGasolina.query(query, params);
        res.json(result.rows);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener movimientos' });
    }
});

// =====================================================
// 7. OBTENER REPORTE DE GASTOS
// =====================================================
router.get('/reportes/gastos', verificarToken, async (req, res) => {
    const { mes, anio } = req.query;
    
    try {
        // Gasto por empleado
        const porEmpleado = await bdGasolina.query(`
            SELECT m.empleado_id, SUM(m.monto) as total
            FROM movimientos m
            WHERE EXTRACT(MONTH FROM m.fecha) = $1 
              AND EXTRACT(YEAR FROM m.fecha) = $2
              AND m.empleado_id IS NOT NULL
            GROUP BY m.empleado_id
            ORDER BY total DESC
        `, [mes, anio]);
        
        // Gasto por unidad
        const porUnidad = await bdGasolina.query(`
            SELECT m.unidad_id, u.placas, u.descripcion, SUM(m.monto) as total
            FROM movimientos m
            LEFT JOIN unidades u ON m.unidad_id = u.id
            WHERE EXTRACT(MONTH FROM m.fecha) = $1 
              AND EXTRACT(YEAR FROM m.fecha) = $2
              AND m.unidad_id IS NOT NULL
            GROUP BY m.unidad_id, u.placas, u.descripcion
            ORDER BY total DESC
        `, [mes, anio]);
        
        // Presupuesto del mes
        const presupuesto = await bdGasolina.query(`
            SELECT monto_inicial, monto_restante, 
                   (monto_inicial - monto_restante) as gastado
            FROM presupuesto_global
            WHERE mes = $1 AND anio = $2
        `, [mes, anio]);
        
        res.json({
            porEmpleado: porEmpleado.rows,
            porUnidad: porUnidad.rows,
            presupuesto: presupuesto.rows[0] || null
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al generar reporte' });
    }
});

// =====================================================
// 8. OBTENER PRESUPUESTO ACTUAL
// =====================================================
router.get('/presupuesto/actual', verificarToken, async (req, res) => {
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();
    
    try {
        const result = await bdGasolina.query(`
            SELECT mes, anio, monto_inicial, monto_restante,
                   (monto_inicial - monto_restante) as gastado
            FROM presupuesto_global
            WHERE mes = $1 AND anio = $2
        `, [mes, anio]);
        
        res.json(result.rows[0] || { mes, anio, monto_inicial: 0, monto_restante: 0, gastado: 0 });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener presupuesto' });
    }
});

module.exports = router;