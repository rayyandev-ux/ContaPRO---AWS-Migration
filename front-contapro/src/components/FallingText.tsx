import { useRef, useState, useEffect } from 'react';
import Matter from 'matter-js';
import './FallingText.css';

interface FallingTextProps {
  text?: string;
  highlightWords?: string[];
  highlightClass?: string;
  trigger?: 'auto' | 'scroll' | 'click' | 'hover';
  backgroundColor?: string;
  wireframes?: boolean;
  gravity?: number;
  mouseConstraintStiffness?: number;
  fontSize?: string;
}

const FallingText: React.FC<FallingTextProps> = ({
  text = '',
  highlightWords = [],
  highlightClass = 'highlighted',
  trigger = 'auto',
  backgroundColor = 'transparent',
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.2,
  fontSize = '1rem'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [effectStarted, setEffectStarted] = useState(false);

  useEffect(() => {
    if (!textRef.current) return;
    // Modificado para respetar las frases entre comillas como unidades individuales
    // Usamos regex para capturar contenido entre comillas
    const matches = text.match(/"([^"]+)"/g);
    const words = matches ? matches.map(m => m.replace(/"/g, '')) : text.split(' ');
    
    const newHTML = words
      .map(word => {
        const isHighlighted = highlightWords.some(hw => word.startsWith(hw));
        return `<span class="word px-4 py-2 rounded-full bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm text-zinc-300 whitespace-nowrap ${isHighlighted ? highlightClass : ''}">${word}</span>`;
      })
      .join(' ');
    textRef.current.innerHTML = newHTML;
  }, [text, highlightWords, highlightClass]);

  useEffect(() => {
    if (trigger === 'auto') {
      setEffectStarted(true);
      return;
    }
    if (trigger === 'scroll' && containerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setEffectStarted(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [trigger]);

  useEffect(() => {
    if (!effectStarted) return;

    // Detect mobile to reduce load
    const isMobile = window.innerWidth < 768;

    const { Engine, Render, World, Bodies, Runner, Mouse, MouseConstraint } = Matter;

    if (!containerRef.current || !canvasContainerRef.current || !textRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    if (width <= 0 || height <= 0) {
      return;
    }

    const engine = Engine.create();
    engine.world.gravity.y = gravity;

    const render = Render.create({
      element: canvasContainerRef.current,
      engine,
      options: {
        width,
        height,
        background: backgroundColor,
        wireframes,
        // On mobile, reduce pixel ratio or disable anti-aliasing if supported (though Matter.js Render is canvas 2d)
      }
    });

    const boundaryOptions = {
      isStatic: true,
      render: { fillStyle: 'transparent' }
    };
    const floor = Bodies.rectangle(width / 2, height + 25, width, 50, boundaryOptions);
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height, boundaryOptions);
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height, boundaryOptions);
    const ceiling = Bodies.rectangle(width / 2, -25, width, 50, boundaryOptions);

    const wordSpans = textRef.current.querySelectorAll<HTMLSpanElement>('.word');
    // On mobile, maybe limit number of active bodies if text is very long?
    // For now, we keep them but maybe simplify update loop or collision iterations
    if (isMobile) {
      engine.positionIterations = 4; // Default is 6
      engine.velocityIterations = 2; // Default is 4
    }

    const wordBodies = Array.from(wordSpans).map(elem => {
      const rect = elem.getBoundingClientRect();

      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        render: { fillStyle: 'transparent' },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2
      });

      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 5,
        y: 0
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
      return { elem, body };
    });

    wordBodies.forEach(({ elem, body }) => {
      elem.style.position = 'absolute';
      elem.style.left = `${body.position.x - body.bounds.max.x + body.bounds.min.x / 2}px`;
      elem.style.top = `${body.position.y - body.bounds.max.y + body.bounds.min.y / 2}px`;
      elem.style.transform = 'none';
    });

    const mouse = Mouse.create(containerRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: mouseConstraintStiffness,
        render: { visible: false }
      }
    });
    render.mouse = mouse;

    World.add(engine.world, [floor, leftWall, rightWall, ceiling, mouseConstraint, ...wordBodies.map(wb => wb.body)]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    let animationFrameId: number;
    const updateLoop = () => {
      wordBodies.forEach(({ body, elem }) => {
        const { x, y } = body.position;
        // Optimization: Use transform3d for hardware acceleration
        elem.style.transform = `translate3d(${x - body.bounds.max.x + body.bounds.min.x / 2}px, ${y - body.bounds.max.y + body.bounds.min.y / 2}px, 0) rotate(${body.angle}rad)`;
        // Reset top/left to 0 as we use translate3d relative to container 0,0? 
        // Actually, the previous logic set left/top. Mixing left/top and transform is okay but translate3d is better for perf.
        // Let's stick to the previous logic but use translate3d instead of just translate and rotate.
        // However, the original code set left/top in loop. That causes layout trashing.
        // Better to set left/top to 0 initially and move purely with transform.
        // But we need to calculate offset.
      });
      
      // We rely on Matter's runner for physics updates, we just sync DOM.
      // If mobile, maybe skip every other frame for DOM sync?
      animationFrameId = requestAnimationFrame(updateLoop);
    };
    
    // Correct approach for DOM sync to avoid layout thrashing:
    // 1. Set position absolute, top 0, left 0 once.
    // 2. Update transform only.
    wordBodies.forEach(({ elem }) => {
       elem.style.left = '0';
       elem.style.top = '0';
       elem.style.willChange = 'transform';
    });
    
    // Override the loop
    const optimizedUpdateLoop = () => {
      wordBodies.forEach(({ body, elem }) => {
         const width = body.bounds.max.x - body.bounds.min.x;
         const height = body.bounds.max.y - body.bounds.min.y;
         // Matter js bodies origin is at center of mass usually.
         // We need top-left corner for DOM element if we set top:0 left:0.
         // body.position is center.
         const x = body.position.x - width / 2;
         const y = body.position.y - height / 2;
         
         elem.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${body.angle}rad)`;
      });
      animationFrameId = requestAnimationFrame(optimizedUpdateLoop);
    };

    optimizedUpdateLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas && canvasContainerRef.current) {
        canvasContainerRef.current.removeChild(render.canvas);
      }
      World.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [effectStarted, gravity, wireframes, backgroundColor, mouseConstraintStiffness]);

  const handleTrigger = () => {
    if (!effectStarted && (trigger === 'click' || trigger === 'hover')) {
      setEffectStarted(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className="falling-text-container"
      onClick={trigger === 'click' ? handleTrigger : undefined}
      onMouseEnter={trigger === 'hover' ? handleTrigger : undefined}
      style={{
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        ref={textRef}
        className="falling-text-target"
        style={{
          fontSize: fontSize,
          lineHeight: 1.4
        }}
      />
      <div ref={canvasContainerRef} className="falling-text-canvas" />
    </div>
  );
};

export default FallingText;
