

# Pissarra-MYP Agora Barcelona 🌐

**Pissarra-MYP Agora Barcelona** es una aplicación web interactiva (Single Page Application - SPA) de alto rendimiento diseñada específicamente para el entorno educativo de **Agora Barcelona International School**. Esta herramienta optimiza la gestión áulica y la planificación didáctica bajo el marco del **Middle Years Programme (MYP)** del Bachillerato Internacional (IB), integrando una pizarra digital infinita, modelado geométrico interactivo en 3D y herramientas de sincronización en tiempo real.

Al ser una **aplicación web estática (Client-Side Web App)**, todo el procesamiento, renderizado y lógica de negocio se ejecuta de manera nativa en el navegador del usuario. Esto elimina la necesidad de servidores de backend complejos o bases de datos relacionales costosas, garantizando una carga instantánea, una alta privacidad de los datos y una infraestructura ágil de mantener.

El repositorio oficial de este proyecto es público y se encuentra alojado en GitHub:
🔗 **[CloscaBuida/pissarra-myp](https://github.com/CloscaBuida/pissarra-myp)**

---

## 🚀 Características Principales

### 1. Estructura Curricular Unificada (MYP)
El diseño de la interfaz sitúa las necesidades del docente en el centro:
*   **Campos de Contextualización:** Cabecera dinámica integrada para gestionar metadatas clave: Asignatura (*Subject*), Unidad (*Unit*), Sesión (*Session*), Declaración de Indagación (*Statement of Inquiry - SOI*) y Conceptos Clave.
*   **Identidad Corporativa Escolar:** Paleta de colores náutica institucional (`#123B61`) con geometrías fluidas y disposición del logotipo optimizada para no interferir con el espacio de dibujo.

### 2. Pizarra Infinita de Alto Rendimiento (`InfiniteCanvas`)
Desarrollada sobre la API 2D de HTML5 mediante un lienzo adaptativo:
*   **8 Tipos de Pincel Avanzados:** *Lápiz, Rotulador, Fluorescente (con operaciones de fusión de capa compostas), Espray, Neón, Caligrafía, Tiza y Línea de puntos*.
*   **Manipulación de Objetos (Mode Select):** Selección libre de cualquier trazo, cuadro de texto o imagen insertada. Los docentes pueden *Mover, Rotar o Escalar* elementos mediante nodos de control, o eliminarlos rápidamente usando las teclas `Suprimir` o `Backspace`.
*   **Navegación Multitáctil:** Soporte completo para pantallas táctiles y tabletas que permite desplazamientos (*Pan*) con dos dits y *Pinch-to-zoom* con un rango dinámico del 20% al 400%.
*   **Herramientas Matemáticas Automatizadas:** Generación instantánea de cubos 3D simétricos, ejes cartesianos de coordenadas $X/Y$, y trazado de funciones matemáticas personalizadas $f(x)$ introducidas por texto.

### 3. Panel de Cuerpos Geométricos en 3D (`Solid3DPanel`)
Entorno de visualización tridimensional nativo integrado mediante **Three.js (WebGL)**:
*   **Biblioteca de Sólidos:** Catálogo que incluye cubos, pirámides cuadrangulares, tetraedres, prismas (triangulares y hexagonales), cilindros, conos, esferas y poliedros clásicos (octaedros, dodecaedres e icosaedres).
*   **Análisis Métrico e Interactivo:** Cálculo automático de áreas laterales, áreas totales, volúmenes, aristas y generatrices al alterar las dimensiones físicas.
*   **Vistas de Explosión Dinámica:** Despliegue interactivo de las caras de los poliedres en el espacio 3D para enseñar visualmente su construcción espacial.
*   **Incrustación de Capturas:** Permite pintar caras de forma individual mediante *raycasting* e insertar instantáneas del modelo directamente en la pizarra infinita en forma de imagen.

### 4. Gestión del Lesson Plan y Sesiones (`Sidebar`)
Panel lateral colapsable dedicado al control del ritmo de la clase:
*   **Mapeo de Criterios:** Espacios para fijar objetivos específicos alineados con los Criterios evaluativos clave (A, B, C).
*   **Temporizadores de Actividad Dinámicos (`TimerRow`):** Bloques independientes con hilos lógicos de tiempo propios (*En progreso, Pausado, Finalizado*). Integran alertas acústicas duales (*beeps*) generadas nativamente a través de la Web Audio API al agotarse el tiempo configurado.

### 5. Sincronización en el Aula (`RoomManager`)
Módulo de colaboración instantánea Punto a Punto (P2P) basado en **PeerJS**:
*   **Modo Servidor / Cliente:** Permite al profesor iniciar una sesión de aula activa (*Host*) o conectar dispositivos de soporte mediante códigos de sala unificados (`MYP-XXXX`).
*   **Flujo WebRTC:** Sincronización en tiempo real de los trazos, las imágenes y el estado del lienzo utilizando multidifusión nativa sin almacenar datos en servidores externos.

---

## 🛠️ Stack Tecnológico

*   **Framework Principal:** React 18+ (Vite)
*   **Gráficos 3D:** Three.js (WebGL nativo)
*   **Comunicación P2P:** PeerJS (WebRTC)
*   **Estilos y Layout:** CSS3 con Variables globales de diseño, transiciones fluidas y API de Pantalla Completa nativa.

---

## 📦 Instalación y Desarrollo Local

Al ser una aplicación basada en Vite, la puesta en marcha local es sumamente ágil:

1. Clonar el repositorio público de GitHub:
   ```bash
   git clone https://github.com/CloscaBuida/pissarra-myp.git
   cd pissarra-myp
   ```
2. Instalar las dependencias de Node.js:
   ```bash
   npm install
   ```
3. Iniciar el servidor de desarrollo local:
   ```bash
   npm run dev
   ```
4. Abrir en el navegador la dirección facilitada por el entorno (por defecto, `http://localhost:5173`).

---

## 🌐 Despliegue en Producción (Cloud / Azure)

Dado que **Pissarra-MYP Agora Barcelona** se compila como un conjunto de archivos estáticos puros (`HTML`, `JS`, `CSS` e imágenes) dentro de la carpeta `dist/`, su despliegue en entornos en la nube es extremadamente económico, escalable y no requiere servidores de aplicación activos (como Node.js o Docker en producción).

Antes de desplegar en cualquier plataforma, genera el compilado optimizado de producción ejecutando:
```bash
npm run build
```

A continuación se detallan las opciones de despliegue recomendadas en la nube, con especial foco en **Microsoft Azure**:

### Opción A: Despliegue en Microsoft Azure

#### 1. Azure Static Web Apps (Recomendado)
Es la solución ideal y nativa de Azure para este tipo de arquitecturas cliente (SPA), integrando flujos automáticos con GitHub.
1. Ve al portal de Azure y selecciona **Crear un recurso** > **Static Web App**.
2. Configura los detalles del recurso (Suscripción, Grupo de recursos y Nombre).
3. En **Detalles de la implementación**, selecciona **GitHub** e inicia sesión. Selecciona la organización, el repositorio (`CloscaBuida/pissarra-myp`) y la rama (ej. `main`).
4. En la sección **Detalles de la compilación** (*Build Details*), selecciona el ajuste preestablecido de **React**.
   *   **Ubicación de la aplicación (*App location*):** `/`
   *   **Ubicación de la API (*Api location*):** Dejar vacío
   *   **Ubicación del artefacto de salida (*Output location*):** `dist`
5. Haz clic en **Revisar y crear**. Azure añadirá de forma automática un archivo de flujo de trabajo (*GitHub Actions*) en tu repositorio que compilará y desplegará la web con cada `git push`.

#### 2. Azure Blob Storage (Alojamiento de sitios web estáticos)
Una alternativa de coste mínimo basada en contenedores de almacenamiento blob.
1. Crea una cuenta de almacenamiento (**Storage Account**) en el portal de Azure.
2. Una vez creada, ve al menú lateral izquierdo, busca la sección **Sitio web estático** (*Static website*) y haz clic en **Habilitar**.
3. Define `index.html` tanto en **Nombre del documento de índice** como en **Ruta del documento de error** (esencial para asegurar el enrutamiento correcto en aplicaciones SPA). Guarda los cambios.
4. Azure creará automáticamente un contenedor de almacenamiento llamado `$web`.
5. Sube todos los archivos contenidos dentro de la carpeta local `dist/` directamente a ese contenedor `$web` (puedes usar el portal de Azure, Azure Storage Explorer o la CLI de Azure).
6. El panel de *Sitio web estático* te proporcionará el **Extremo principal** (una URL pública del tipo `https://<nombre>.z16.web.core.windows.net/`) para acceder a la pizarra.

### Opción B: Despliegue en otros entornos estáticos alternativos
Debido a la naturaleza cliente de la aplicación, también puedes arrastrar y soltar la carpeta `dist/` en servicios de distribución global instantánea como:
*   **Vercel / Netlify:** Vinculando directamente el repositorio público `CloscaBuida/pissarra-myp`.
*   **GitHub Pages:** Configurando el repositorio para compilar mediante GitHub Actions y servir la rama de publicación resultante.
