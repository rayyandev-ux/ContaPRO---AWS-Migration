import React from 'react';

export const PricingSparkles = ({ color = "text-white" }: { color?: string }) => {
  return (
    <div className="absolute inset-0 pointer-events-none w-full h-full" aria-hidden="true">
      {/* Top Left */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`absolute -top-3 -left-3 w-6 h-6 ${color} opacity-0 scale-50 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-[-15deg]`}
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
      </svg>
      
      {/* Top Right */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`absolute -top-3 -right-3 w-6 h-6 ${color} opacity-0 scale-50 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-[15deg] delay-75`}
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
      </svg>
      
      {/* Bottom Left */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`absolute -bottom-3 -left-3 w-6 h-6 ${color} opacity-0 scale-50 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-[-45deg] delay-100`}
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
      </svg>

      {/* Bottom Right */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`absolute -bottom-3 -right-3 w-6 h-6 ${color} opacity-0 scale-50 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-[45deg] delay-150`}
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
      </svg>
      
      {/* Extra small sparkles for more detail */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`absolute top-0 left-1/4 w-3 h-3 ${color} opacity-0 -translate-y-2 transition-all duration-700 ease-out group-hover:opacity-70 group-hover:translate-y-[-8px] delay-200`}
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
      </svg>
      
       <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`absolute bottom-0 right-1/4 w-3 h-3 ${color} opacity-0 translate-y-2 transition-all duration-700 ease-out group-hover:opacity-70 group-hover:translate-y-[8px] delay-300`}
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
      </svg>

    </div>
  );
};
