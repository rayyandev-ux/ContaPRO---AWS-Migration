# Plan: Convertir Stats Cards de Gastos en Elementos Interactivos

## Objetivo
Mejorar las 3 tarjetas de estadísticas ("Total del Mes", "Gasto más Alto", "Total Transacciones") en la página de `/expenses` para que sean clickeables. Al hacer clic, se mostrará un pop-up o modal (Dialog) con efecto de desenfoque (`backdrop-blur`) en el fondo, mostrando información detallada y contextual para cada métrica.

## Pasos de Implementación

### 1. Definir el Estado y Componente del Pop-up (Modal)
- **Acción:** Importar los componentes de `Dialog` (desde `@/components/ui/dialog`) en `page.tsx` o crear un estado para manejar qué tarjeta fue seleccionada.
- **Detalles:** Crear variables de estado, ej: `const [selectedStat, setSelectedStat] = useState<'total' | 'highest' | 'transactions' | null>(null);`

### 2. Hacer las Tarjetas Clickeables
- **Acción:** Transformar los `div` de las tarjetas en botones o envolverlos en componentes interactivos que abran el modal correspondiente al hacer clic.
- **Detalles:** Añadir `cursor-pointer`, mejorar un poco el efecto `hover` (ej: un sutil brillo en el borde) y añadir el evento `onClick={() => setSelectedStat('xxx')}`.

### 3. Diseñar el Contenido de los Pop-ups (Contextual)
Según a qué tarjeta se le dé clic, el modal mostrará información diferente. Aquí están las ideas para cada uno:

#### A. Modal: Total del Mes
- **Título:** Resumen de Gastos del Mes
- **Contenido:** 
  - Un pequeño gráfico circular o de barras (reutilizando `DashboardCharts` o algo simple) que muestre cómo se compone ese total (por categoría o por método de pago).
  - Promedio de gasto diario en el mes actual.
  - Comparativa rápida (ej. "Llevas gastado un X% del mes").

#### B. Modal: Gasto más Alto
- **Título:** Detalle del Gasto más Alto
- **Contenido:**
  - Mostrar los detalles completos de esa transacción específica: Proveedor, Categoría, Fecha, Método de Pago, y si es Factura/Boleta.
  - Un botón directo para "Ver Documento" o editar ese gasto específico.

#### C. Modal: Total Transacciones
- **Título:** Desglose de Transacciones
- **Contenido:**
  - Resumen rápido: Cuántas transacciones son Facturas, cuántas Boletas y cuántas Informales.
  - Los 3 proveedores o lugares donde más transacciones se han hecho este mes.

### 4. Estilos del Modal (Glassmorphism)
- **Acción:** Asegurar que el componente del Modal siga el mismo estilo que la página.
- **Detalles:** El fondo general oscuro (`bg-black/40 backdrop-blur-sm`), y el contenedor del modal con `bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl text-white`.

### 5. Traducciones (Opcional)
- **Acción:** Asegurar que los nuevos textos (títulos de modales, detalles) tengan soporte para los archivos de idioma (`en`, `es`, `pt`) si es necesario, o mantenerlo simple primero.