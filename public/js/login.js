// Usar el puerto actual de la página
const API_URL = `http://localhost:${window.location.port}/api`;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            window.location.href = '/dashboard.html';
        } else {
            errorMsg.textContent = data.error || 'Error al iniciar sesión';
            errorMsg.classList.add('show');
        }
    } catch (error) {
        errorMsg.textContent = 'Error de conexión con el servidor';
        errorMsg.classList.add('show');
        console.error('Error:', error);
    }
});