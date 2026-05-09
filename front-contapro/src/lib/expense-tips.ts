export function getExpenseTip(categoryName: string, amount: number, currency: string, seed?: string): { title: string, text: string, icon: string } {
  const name = (categoryName || "").toLowerCase();

  // Comida y Restaurantes
  if (name.includes("comida") || name.includes("food") || name.includes("restaurante") || name.includes("delivery") || name.includes("cena")) {
    if (amount > 100) {
      return {
        title: "Cuidado con salir mucho",
        text: "Los gastos en restaurantes suman rápidamente. Planificar tus comidas de la semana puede ayudarte a ahorrar hasta un 30% en comida.",
        icon: "🍔"
      };
    }
    return {
      title: "Tip de Comida",
      text: "Cocinar en casa es la forma número uno de multiplicar tus ahorros mensuales.",
      icon: "🥗"
    };
  }

  // Transporte y Auto
  if (name.includes("transporte") || name.includes("taxi") || name.includes("uber") || name.includes("gasolina") || name.includes("auto")) {
    return {
      title: "Optimiza tus traslados",
      text: "Si usas taxi frecuentemente, evalúa si una suscripción o usar alternativas compartidas ciertos días reduce tu gasto de movilidad mensual.",
      icon: "🚗"
    };
  }

  // Entretenimiento y Suscripciones
  if (name.includes("entretenimiento") || name.includes("netflix") || name.includes("spotify") || name.includes("suscripciones") || name.includes("cine") || name.includes("diversión")) {
    return {
      title: "Audita tus suscripciones",
      text: "A veces pagamos por cosas que ya no usamos. Da de baja 1 servicio de streaming que no hayas visto en los últimos 30 días para liberar dinero extra.",
      icon: "🍿"
    };
  }

  // Salud y Farmacia
  if (name.includes("salud") || name.includes("farmacia") || name.includes("médico") || name.includes("gym") || name.includes("gimnasio")) {
    return {
      title: "La salud primero",
      text: "Invertir en tu salud y bienestar jamás será un desperdicio. Asegúrate de incluir estos montos como parte recurrente de tu presupuesto base.",
      icon: "⚕️"
    };
  }

  // Servicios Casa (Agua, luz)
  if (name.includes("luz") || name.includes("agua") || name.includes("servicios") || name.includes("hogar") || name.includes("internet")) {
    return {
      title: "Servicios del Hogar",
      text: "Los recibos a veces suben sin darnos cuenta. Verifica que no haya fugas invisibles (como enchufes que consumen en reposo) para pagar menos el próximo mes.",
      icon: "💡"
    };
  }

  // Ropa o Compras
  if (name.includes("ropa") || name.includes("compras") || name.includes("shopping") || name.includes("zapatos")) {
    return {
      title: "Regla de las 48 horas",
      text: "La próxima vez, antes de comprar algo no esencial, espera 48 horas. Si aún lo quieres, cómpralo. Evita compras impulsivas.",
      icon: "🛍️"
    };
  }

  // Default o misceláneo si es alto:
  if (amount > 500) {
    return {
      title: "Gasto Considerable",
      text: `Este es un gasto importante de ${amount} ${currency}. Asegúrate de etiquetarlo correctamente para no distorsionar tu presupuesto mensual.`,
      icon: "🔍"
    };
  }

  // Tip genérico financiero (como si fuera el asistente quien habla)
  const defaultTips = [
    {
      title: "El Poder de los Centavos",
      text: "Los gastos menores o 'hormiga' (como un café al día) pueden costarte cientos anualmente. Obsérvalos de cerca.",
      icon: "🐜"
    },
    {
      title: "Págate a ti Mismo",
      text: "Apenas recibas tu pago, transfiere un % fijo a una cuenta de ahorros apartada. No ahorres lo que sobra después de gastar.",
      icon: "🐷"
    },
    {
      title: "Categoriza Todo",
      text: "Mantener una buena clasificación te permitirá usar gráficos del Dashboard para descubrir agujeros negros en tus finanzas.",
      icon: "📊"
    }
  ];

  if (seed) {
    // Deterministic selection based on seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % defaultTips.length;
    return defaultTips[index];
  }

  // Fallback to random if no seed provided (unlikely in this context but safe)
  return defaultTips[Math.floor(Math.random() * defaultTips.length)];
}
