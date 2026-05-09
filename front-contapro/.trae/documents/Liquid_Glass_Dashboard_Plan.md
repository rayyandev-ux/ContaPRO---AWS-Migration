# Plan: Rediseño del Dashboard con Estilo Liquid Glass

El objetivo es actualizar el diseño visual del Dashboard para que su fondo coincida con el de las páginas de login/registro (con el componente interactivo `Aurora` y un tema oscuro), y que los paneles/tarjetas del dashboard adopten el estilo "Liquid Glass" (glassmorphism translúcido con bordes y brillos).

## 1. Modificar el Layout Base del Dashboard
Actualmente, `src/app/[locale]/(dashboard)/layout.tsx` tiene un fondo estático (blanco/gris en modo claro y un color base en oscuro con unos círculos borrosos).
**Acciones:**
- Eliminar el fondo actual de gradientes y círculos.
- Importar y renderizar el componente `<Aurora />` en el fondo (igual que en `LoginContent.tsx`).
- Forzar o asegurar que el layout esté en modo oscuro (o que el estilo base se adapte correctamente al fondo oscuro de Aurora).

## 2. Actualizar el DashboardShell (Navbar y Sidebar)
**Acciones:**
- `DashboardShell.tsx`: Actualizar las clases de la barra lateral (sidebar) y la barra superior (header) para que en lugar de usar fondos sólidos (`bg-card`), utilicen un estilo translúcido tipo liquid glass.
- Ejemplo de clases a inyectar: `bg-white/5 backdrop-blur-[12px] border-white/10`.

## 3. Crear Clases CSS Globales para Liquid Glass
Para no repetir todo el bloque de clases de Tailwind (gradientes, bordes, sombras y destellos) en cada tarjeta (Cards, Panels) del dashboard, crearemos utilidades CSS en `globals.css`.
**Acciones:**
- En `src/app/[locale]/globals.css`, crear clases como `.liquid-glass-card`, `.liquid-glass-highlight-top`, y `.liquid-glass-highlight-bottom`.
- Estas clases encapsularán el estilo: `backdrop-blur-[12px] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] bg-gradient-to-b from-white/10 to-white/5 border-white/20`.

## 4. Aplicar el Estilo a las Tarjetas del Dashboard (Cards)
**Acciones:**
- Modificar componentes clave que renderizan paneles (ej. `Card` de shadcn en `src/components/ui/card.tsx` o aplicarlo directamente donde se usan las cards en las vistas de presupuesto, dashboard principal, etc.).
- Reemplazar las clases de fondo sólido por las nuevas clases liquid glass.

## Resumen de Tareas
1. Editar `src/app/[locale]/(dashboard)/layout.tsx` para inyectar `<Aurora />`.
2. Añadir estilos globales `.liquid-glass-card` en `globals.css`.
3. Editar `src/app/[locale]/(dashboard)/_components/DashboardShell.tsx` para dar transparencia a los menús de navegación.
4. Aplicar los estilos a las `Card` en `src/components/ui/card.tsx` para que todo el contenido del dashboard adopte el efecto cristalino automáticamente.