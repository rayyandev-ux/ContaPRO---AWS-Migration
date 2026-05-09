'use client';

import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usePathname } from '@/i18n/routing';

type Props = {
  plan?: string;
  tutorialSeen?: boolean;
};

export default function InteractiveTutorial({ plan = 'FREE', tutorialSeen }: Props) {
  const pathname = usePathname();
  const isRunning = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!tutorialSeen) return;
    
    if (isRunning.current) return;

    // Small delay to allow elements to render and animations to finish
    const timer = setTimeout(() => {
      const isMobile = window.innerWidth < 768;
      const isFree = plan.toUpperCase() === 'FREE';
      
      const emailNote = isFree 
        ? '<br/><br/><span style="color: #ef4444; font-weight: bold;">Nota:</span> Como usuario de plan FREE, necesitarás desbloquear un plan PRO para vincular tu email.' 
        : '<br/><br/>Vincula tu Gmail para leer comprobantes y gastos automáticamente.';

      let currentTourKey = '';
      let steps: any[] = [];

      if (pathname === '/dashboard') {
        const hasSeenGlobal = localStorage.getItem('dashboardTourSeen');
        const hasSeenSection = localStorage.getItem('dashboardSectionTourSeen');
        
        if (hasSeenGlobal !== 'true') {
          currentTourKey = 'dashboardTourSeen';
          steps = isMobile ? [
            { element: 'body', popover: { title: '🚀 ¡Bienvenido a tu Dashboard!', description: 'Tu centro de control financiero. Te daré un breve recorrido interactivo para que domines ContaPRO.', align: 'center' } },
            { element: '#mobile-nav-dashboard', popover: { title: '📊 Resumen', description: 'Aquí verás un resumen de tus gastos, promedio diario, saldo restante y tendencias.', side: 'top', align: 'center' } },
            { element: '#mobile-nav-chat', popover: { title: '💬 Registra tu primer gasto', description: '¡La magia de ContaPRO! Toca aquí para registrar gastos hablando, escribiendo o enviando una foto.', side: 'top', align: 'center' } },
            { element: '#mobile-nav-budget', popover: { title: '🐷 Tu Presupuesto', description: 'Controla tu dinero usando el método de sobres. Asigna montos por categoría y no te pases de la raya.', side: 'top', align: 'center' } },
            { element: '#mobile-nav-savings', popover: { title: '🎯 Metas de Ahorro', description: 'Crea metas (ej: "Viaje a Cancún") y hazles seguimiento visual hasta completarlas.', side: 'top', align: 'center' } },
            { element: '#mobile-menu-btn', popover: { title: '🔗 Integraciones y más', description: `Toca aquí para abrir el menú principal. Desde "Integraciones" podrás conectar WhatsApp y Telegram.${emailNote}`, side: 'bottom', align: 'start' } }
          ] : [
            { element: 'body', popover: { title: '🚀 ¡Bienvenido a tu Dashboard!', description: 'Tu centro de control financiero. Te daré un breve recorrido interactivo para que domines ContaPRO.', align: 'center' } },
            { element: '#nav-dashboard', popover: { title: '📊 Explora tu Dashboard', description: 'Aquí verás un resumen de tus gastos, promedio diario, saldo restante y tendencias.', side: 'right', align: 'start' } },
            { element: '#nav-chat', popover: { title: '💬 Registra tu primer gasto', description: '¡La magia de ContaPRO! Haz click aquí para registrar gastos hablando, escribiendo o enviando fotos de tus boletas.', side: 'right', align: 'start' } },
            { element: '#nav-budget', popover: { title: '🐷 Domina tu Presupuesto', description: 'Controla tu dinero usando el método de sobres. Asigna montos a cada categoría y recibe alertas.', side: 'right', align: 'start' } },
            { element: '#nav-savings', popover: { title: '🎯 Metas de Ahorro', description: 'Crea metas y hazles seguimiento visual hasta completarlas.', side: 'right', align: 'start' } },
            { element: '#nav-integrations', popover: { title: '🔗 Conecta tu canal preferido', description: `ContaPRO cobra vida cuando lo conectas a WhatsApp, Telegram o Gmail.${emailNote}`, side: 'right', align: 'start' } }
          ];
        } else if (hasSeenSection !== 'true') {
          currentTourKey = 'dashboardSectionTourSeen';
          steps = [
            { element: '#chart-balance', popover: { title: 'Balance General', description: 'Visualiza tu saldo, ingresos y gastos del mes actual.', side: 'top', align: 'center' } },
            { element: '#chart-streak', popover: { title: 'Racha Activa', description: 'Mantén el hábito registrando gastos continuamente para no perder la racha.', side: 'top', align: 'center' } },
            { element: '#chart-categories', popover: { title: 'Distribución', description: 'Descubre en qué categorías gastas más tu dinero de un solo vistazo.', side: 'top', align: 'center' } },
            { element: '#dashboard-export-btn', popover: { title: 'Exportar Datos', description: 'Descarga un reporte de tus movimientos en formato Excel.', side: 'bottom', align: 'center' } },
            { element: '#dashboard-chat-btn', popover: { title: 'Asistente IA', description: 'Habla con ContaPRO en cualquier momento para registrar gastos o consultar tu información.', side: 'bottom', align: 'center' } },
          ];
        }
      } else if (pathname === '/transactions') {
        if (localStorage.getItem('transactionsTourSeen') !== 'true') {
          currentTourKey = 'transactionsTourSeen';
          steps = [
            { element: '#new-transaction-btn', popover: { title: 'Nuevo Movimiento', description: 'Registra un gasto o ingreso manualmente desde aquí.', side: 'bottom', align: 'end' } },
            { element: '#transaction-search', popover: { title: 'Buscador', description: 'Encuentra transacciones rápidamente por nombre o descripción.', side: 'bottom', align: 'center' } },
            { element: '#category-filter', popover: { title: 'Filtro por Categoría', description: 'Filtra tus movimientos para ver exactamente en qué gastaste.', side: 'bottom', align: 'center' } },
            { element: '#saved-views-trigger', popover: { title: 'Vistas Guardadas', description: 'Guarda tus filtros favoritos para acceder a ellos con un solo clic.', side: 'bottom', align: 'center' } },
            { element: '#transactions-list', popover: { title: 'Tus Movimientos', description: 'Aquí verás el detalle de todas tus transacciones. Puedes seleccionar varias para eliminarlas en masa.', side: 'top', align: 'center' } },
          ];
        }
      } else if (pathname === '/budget') {
        if (localStorage.getItem('budgetTourSeen') !== 'true') {
          currentTourKey = 'budgetTourSeen';
          steps = [
            { element: '#budget-header-title', popover: { title: 'Presupuesto Mensual', description: 'Controla cuánto gastas y planifica tus finanzas.', side: 'bottom', align: 'start' } },
            { element: '#card-total-balance', popover: { title: 'Saldo Total', description: 'La suma de todas tus cuentas vinculadas.', side: 'bottom', align: 'center' } },
            { element: '#card-unallocated-budget', popover: { title: 'Por Asignar', description: 'Este es el dinero que aún no has distribuido en tus sobres de categorías.', side: 'bottom', align: 'center' } },
            { element: '#chart-budget-trend', popover: { title: 'Tendencia Mensual', description: 'Observa cómo se comporta tu gasto frente a tu límite establecido a lo largo del tiempo.', side: 'top', align: 'center' } },
            { element: '#section-category-envelopes', popover: { title: 'Sobres de Categorías', description: 'El método de sobres: asigna un límite específico a cada categoría para no pasarte de la raya.', side: 'top', align: 'start' } },
            { element: '#btn-add-envelope', popover: { title: 'Añadir Sobre', description: 'Crea un nuevo sobre para una categoría específica y empieza a controlarla.', side: 'bottom', align: 'end' } },
          ];
        }
      } else if (pathname === '/savings') {
        if (localStorage.getItem('savingsTourSeen') !== 'true') {
          currentTourKey = 'savingsTourSeen';
          steps = [
            { element: '#savings-page-container', popover: { title: 'Metas de Ahorro', description: 'Crea metas y hazles seguimiento visual hasta completarlas.', side: 'bottom', align: 'start' } },
            { element: '#btn-new-goal', popover: { title: 'Nueva Meta', description: 'Crea un objetivo (ej: "Viaje a Cancún") y define cuánto necesitas ahorrar.', side: 'bottom', align: 'end' } },
            { element: '#savings-summary-cards', popover: { title: 'Resumen por Moneda', description: 'Mira cuánto tienes ahorrado en total, separado por tipo de moneda.', side: 'bottom', align: 'center' } },
            { element: '#savings-goals-list', popover: { title: 'Progreso de Metas', description: 'Añade fondos a tus metas desde aquí y mira cómo avanza la barra de progreso.', side: 'top', align: 'center' } },
          ];
        }
      } else if (pathname === '/categories') {
        if (localStorage.getItem('categoriesTourSeen') !== 'true') {
          currentTourKey = 'categoriesTourSeen';
          steps = [
            { element: '#categories-page-container', popover: { title: 'Gestión de Categorías', description: 'Personaliza cómo clasificas tus ingresos y gastos.', side: 'bottom', align: 'start' } },
            { element: '#btn-new-category', popover: { title: 'Crear Categoría', description: 'Crea categorías personalizadas con tus propios emojis.', side: 'bottom', align: 'end' } },
            { element: '#my-categories-list', popover: { title: 'Tus Categorías', description: 'Aquí aparecerán las categorías que hayas creado. Puedes editarlas o eliminarlas en cualquier momento.', side: 'top', align: 'center' } },
            { element: '#system-categories-list', popover: { title: 'Categorías del Sistema', description: 'Categorías predeterminadas listas para usar. Estas no se pueden eliminar.', side: 'top', align: 'center' } },
          ];
        }
      } else if (pathname === '/payment-methods') {
        if (localStorage.getItem('paymentMethodsTourSeen') !== 'true') {
          currentTourKey = 'paymentMethodsTourSeen';
          steps = [
            { element: '#payment-methods-page-container', popover: { title: 'Tus Cuentas y Tarjetas', description: 'Administra dónde guardas tu dinero: cuentas bancarias, tarjetas o efectivo.', side: 'bottom', align: 'start' } },
            { element: '#btn-new-payment-method', popover: { title: 'Añadir Cuenta', description: 'Registra un nuevo método de pago para mantener un control exacto de tus saldos.', side: 'bottom', align: 'end' } },
            { element: '#payment-methods-list', popover: { title: 'Tus Métodos', description: 'Visualiza el saldo actual de cada cuenta en tiempo real.', side: 'top', align: 'center' } },
            { element: '#payment-method-card-0', popover: { title: 'Acciones Rápidas', description: 'Haz clic en una tarjeta para ver su historial, o usa el menú de 3 puntos para transferir o rebalancear el saldo.', side: 'top', align: 'center' } },
          ];
        }
      } else if (pathname === '/integrations') {
        if (localStorage.getItem('integrationsTourSeen') !== 'true') {
          currentTourKey = 'integrationsTourSeen';
          steps = [
            { element: '#integrations-page-container', popover: { title: 'Centro de Integraciones', description: 'Conecta ContaPRO con tus aplicaciones favoritas para automatizar tus registros.', side: 'bottom', align: 'start' } },
            { element: '#gmail-integration', popover: { title: 'Conexión con Gmail', description: `Vincula tu correo para que la IA lea tus boletas y facturas automáticamente.${emailNote}`, side: 'bottom', align: 'center' } },
            { element: '#whatsapp', popover: { title: 'Bot de WhatsApp', description: 'Registra gastos enviando mensajes de voz o fotos directamente por WhatsApp.', side: 'bottom', align: 'center' } },
            { element: '#telegram', popover: { title: 'Bot de Telegram', description: 'Una alternativa rápida y segura para interactuar con tu asistente financiero.', side: 'bottom', align: 'center' } },
          ];
        }
      }

      if (!currentTourKey || steps.length === 0) return;

      // Filter out elements that don't exist in the DOM to avoid breaking the tour
      const validSteps = steps.filter(step => {
        if (step.element === 'body') return true;
        return document.querySelector(step.element as string) !== null;
      });

      if (validSteps.length === 0) {
        return;
      }

      isRunning.current = true;

      const driverObj = driver({
        showProgress: true,
        progressText: 'Paso {{current}} de {{total}}',
        nextBtnText: 'Siguiente &rarr;',
        prevBtnText: '&larr; Atrás',
        doneBtnText: '¡Entendido!',
        allowClose: true,
        steps: validSteps,
        onDestroyStarted: () => {
          if (!driverObj.hasNextStep() || confirm("¿Estás seguro que deseas cerrar el tutorial?")) {
            localStorage.setItem(currentTourKey, 'true');
            driverObj.destroy();
            isRunning.current = false;
          }
        }
      });

      driverObj.drive();
    }, 1000);

    return () => {
      clearTimeout(timer);
      isRunning.current = false;
    };
  }, [plan, tutorialSeen, pathname]);

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .driver-popover {
        background-color: rgba(20, 20, 20, 0.9) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        color: white !important;
        border-radius: 20px !important;
        padding: 20px !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
        font-family: inherit !important;
        max-width: 320px !important;
        z-index: 100000 !important;
      }
      .driver-popover-title {
        color: white !important;
        font-size: 1.125rem !important;
        font-weight: 700 !important;
        margin-bottom: 8px !important;
      }
      .driver-popover-description {
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 0.9rem !important;
        line-height: 1.5 !important;
      }
      .driver-popover-footer {
        margin-top: 16px !important;
      }
      .driver-popover-progress-text {
        color: rgba(255, 255, 255, 0.5) !important;
        font-size: 0.8rem !important;
      }
      .driver-popover-next-btn, .driver-popover-prev-btn {
        background-color: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 8px !important;
        padding: 6px 12px !important;
        font-size: 0.85rem !important;
        font-weight: 500 !important;
        text-shadow: none !important;
        transition: all 0.2s ease !important;
      }
      .driver-popover-next-btn:hover, .driver-popover-prev-btn:hover {
        background-color: rgba(255, 255, 255, 0.2) !important;
      }
      .driver-popover-close-btn {
        color: rgba(255, 255, 255, 0.5) !important;
      }
      .driver-popover-close-btn:hover {
        color: white !important;
      }
      .driver-popover-arrow {
        border-color: rgba(20, 20, 20, 0.9) !important;
      }
      /* Prevenir layout shift (parpadeo de scrollbar) ocultando el overflow del contenedor principal */
      #main-scroll-container:has(>.driver-active-element) {
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }
      body.driver-active {
        padding-right: 0 !important;
      }
    `}} />
  );
}
