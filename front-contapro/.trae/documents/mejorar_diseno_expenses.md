# Plan: Mejorar Diseño e Interactividad de Gastos (/expenses)

## Objetivo
Transformar la página de `/expenses` para que deje de ser una simple tabla "aburrida y neutral". Se busca inyectarle la energía y el dinamismo visual del Dashboard, utilizando animaciones, tarjetas de resumen, estados interactivos y colores vibrantes que conecten mejor con el usuario (glassmorphism avanzado + framer-motion).

## Pasos de Implementación

### 1. Añadir Tarjetas de Resumen (Stats Cards) Animadas
- **Acción:** Insertar una fila superior con 3 tarjetas de resumen rápido antes de la tabla/lista de gastos.
- **Contenido sugerido:** "Total del Mes", "Gasto más Alto", "Total de Transacciones".
- **Estilo:** Utilizar el mismo diseño que el Dashboard (`bg-white/5`, `backdrop-blur-md`, iconos flotantes grandes con opacidad baja de fondo, colores vibrantes como esmeralda, púrpura o azul en los iconos y montos). Añadir un efecto hover que expanda suavemente la tarjeta.

### 2. Modernizar la Barra de Búsqueda y Filtros
- **Acción:** Rediseñar la sección de filtros para que sea más amigable e interactiva.
- **Detalles:** 
  - Convertir el selector de "Tipo de comprobante" y "Categoría" en píldoras (pills) clickeables o un diseño de barra flotante más limpio, en lugar de selectores HTML tradicionales aburridos.
  - Añadir transiciones suaves (foco con anillos brillantes `focus:ring-purple-500/50`) a los inputs.

### 3. Animaciones en la Lista y Tabla (Framer Motion)
- **Acción:** Implementar `framer-motion` para la aparición de los elementos.
- **Detalles:** 
  - Que las filas de la tabla y las tarjetas en la vista móvil aparezcan en cascada (staggered fade-in) al cargar la página.
  - Mejorar el estado de carga (`loading`) con un esqueleto (skeleton loader) con un suave efecto de pulso brillante, en lugar del texto "Cargando...".

### 4. Botón de "Nuevo Gasto" Dinámico
- **Acción:** Darle más prominencia al botón principal de acción.
- **Detalles:** Aplicar un gradiente vibrante (ej. `bg-gradient-to-r from-indigo-500 to-purple-600`), un efecto de sombra difuminada (`shadow-lg shadow-purple-500/20`), y una animación de pulso o brillo en hover para invitar a la interacción.

### 5. Estados Vacíos (Empty States) Divertidos
- **Acción:** Mejorar el mensaje de "No hay gastos".
- **Detalles:** Si no hay resultados o si es un mes vacío, mostrar un ícono grande y amigable (ej. una caja vacía o un fantasma con opacidad baja) con un texto motivador, invitando activamente a registrar el primer gasto.

### 6. Interactividad en Filas de Tabla
- **Acción:** Mejorar el feedback táctil/visual de las filas.
- **Detalles:** 
  - Hacer que el hover sobre una fila no solo cambie el fondo (`hover:bg-white/5`), sino que tal vez ilumine un sutil borde lateral.
  - Asegurar que los botones de acción (Ver, Eliminar) se deslicen suavemente (`translate-x`) al aparecer.

## Resultado Esperado
Una página de gastos que se sienta como un centro de control activo, recompensando visualmente al usuario al navegar, buscar o interactuar con sus datos financieros, manteniendo la consistencia de la paleta oscura (glassmorphism) pero con "chispa".