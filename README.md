
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
