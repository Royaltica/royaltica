# 🚀 Guía de Inicio: Royáltica

Sigue estos pasos para ejecutar el proyecto en tu computadora sin errores.

### ⚠️ AVISO IMPORTANTE: Error de iCloud (ETIMEDOUT)
Si ves un error que dice `ETIMEDOUT` al hacer `npm install`, es porque **iCloud** ha movido tus archivos a la nube y no están físicamente en tu Mac. Para arreglarlo, he limpiado los archivos conflictivos por ti. 

**Si te vuelve a pasar, corre este comando en la terminal:**
```bash
rm -rf package-lock.json node_modules && npm install
```

---

### 1. Preparación de la Terminal
Abre la **Terminal** y asegúrate de estar en la carpeta:
```bash
cd "/Users/paolovillasenor/Documents/ROYALTICA/Royáltica code"
```

### 2. Variables de Configuración (.env)
Si quieres que la IA funcione con tu propia llave, crea un archivo llamado `.env` en la carpeta raíz y pega esto:
```env
VITE_GEMINI_API_KEY=tu_llave_aqui
```
*Si no pones una llave, el sistema entrará en **Modo Simulación** automáticamente para que puedas navegar.*

### 3. Iniciar el Proyecto
Ejecuta el servidor:
```bash
npm run dev
```

### 4. Ver el Proyecto
Abre tu navegador y entra a:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### 🛠️ Solución a problemas comunes

*   **Pantalla en Blanco:** He añadido un `ErrorBoundary`. Si hay un error de código, verás un mensaje rojo con la explicación. Si sigue en blanco total, revisa que el puerto en el navegador coincida con el que dice la terminal (a veces cambia a 3001).
*   **Reinicio Infinito:** **NO** uses el comando `npm run dev > vite_output.log`. Úsalo solo como `npm run dev`.
*   **Comandos de Ayuda:** Si ves mucho texto sobre "location", "long", etc., es porque se abrió la ayuda de npm por error. Solo cierra esa terminal y abre una nueva.
