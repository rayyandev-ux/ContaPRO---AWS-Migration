# Apply Dashboard Design System Spec

## Why
El panel principal (`/dashboard`) tiene un estilo de diseño oscuro, moderno y elegante basado en "glassmorphism" (fondos translúcidos `bg-white/5`, `backdrop-blur`, bordes sutiles `border-white/10`, y tarjetas redondeadas grandes como `rounded-3xl` o `rounded-2xl`). Sin embargo, otras páginas de la plataforma (`/expenses`, `/categories`, `/payment-methods`, `/budget`, `/savings`, `/integrations`, etc.) no comparten esta misma estética al 100%, lo que genera una experiencia visual inconsistente para el usuario. Es necesario estandarizar todas las vistas bajo el mismo lenguaje de diseño del dashboard.

## What Changes
- Aplicar fondos oscuros translúcidos (`bg-white/5` o similar) y desenfoque (`backdrop-blur-md` o superior) a los contenedores principales y tarjetas en todas las páginas internas.
- Estandarizar los bordes (`border border-white/10` o `border-white/20`) en las tarjetas y tablas.
- Asegurar que los radios de los bordes sean consistentes (`rounded-2xl` o `rounded-3xl` para contenedores grandes, `rounded-xl` para elementos medianos).
- Ajustar la tipografía: colores blancos (`text-white`), textos secundarios tenues (`text-white/50` o `text-white/60`), y títulos/encabezados con el estilo adecuado.
- Modificar componentes de UI compartidos (tablas, modales, botones, inputs) para que encajen con este tema oscuro "glassmorphism".
- **BREAKING**: Cualquier diseño claro o de tema diferente en las rutas mencionadas será sobrescrito permanentemente por el tema oscuro unificado.

## Impact
- Affected specs: UI Consistency, Theme.
- Affected code: 
  - `src/app/[locale]/(dashboard)/expenses/`
  - `src/app/[locale]/(dashboard)/categories/`
  - `src/app/[locale]/(dashboard)/payment-methods/`
  - `src/app/[locale]/(dashboard)/budget/`
  - `src/app/[locale]/(dashboard)/savings/`
  - `src/app/[locale]/(dashboard)/integrations/`
  - Compartidos: `src/components/ui/` (posibles ajustes a componentes base si es necesario).

## ADDED Requirements
### Requirement: UI Consistency
El sistema DEBE presentar un lenguaje de diseño visual uniforme en todas las vistas del usuario autenticado.

#### Scenario: Navegación entre módulos
- **WHEN** el usuario navega desde `/dashboard` a `/expenses` o cualquier otro módulo.
- **THEN** el usuario debe ver el mismo estilo de tarjetas oscuras, desenfoques y tipografía sin saltos bruscos de tema o estructura.

## MODIFIED Requirements
### Requirement: Estilos de Componentes Internos
Todos los contenedores de contenido principales dentro de las rutas del dashboard ahora deben usar clases de Tailwind para simular vidrio esmerilado sobre un fondo oscuro, en lugar de fondos sólidos o blancos.