import React from 'react';
import './GlitchText.css';

interface GlitchTextProps {
  text: string;
  className?: string;
  fontSize?: string;
}

const GlitchText: React.FC<GlitchTextProps> = ({ 
  text, 
  className = "",
  fontSize = "clamp(2rem, 8vw, 8rem)"
}) => {
  return (
    <div className={`glitch-wrapper ${className}`} style={{ fontSize }}>
      <h2 
        className="glitch glitch-flicker font-mono uppercase" 
        data-text={text}
      >
        {text}
      </h2>
    </div>
  );
};

export default GlitchText;
