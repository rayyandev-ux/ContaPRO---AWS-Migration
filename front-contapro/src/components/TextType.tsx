"use client";

import React, { useState, useEffect } from 'react';
import './TextType.css';

interface TextTypeProps {
  text: string | string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  loop?: boolean;
  className?: string;
  cursorCharacter?: string;
  cursorClassName?: string;
  showCursor?: boolean;
}

export default function TextType({
  text,
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseDuration = 2000,
  loop = true,
  className = '',
  cursorCharacter = '|',
  cursorClassName = 'text-type-cursor',
  showCursor = true,
}: TextTypeProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeedState, setTypingSpeedState] = useState(typingSpeed);

  useEffect(() => {
    const texts = Array.isArray(text) ? text : [text];
    const i = loopNum % texts.length;
    const fullText = texts[i];

    const handleTyping = () => {
      setDisplayedText((prev) =>
        isDeleting
          ? fullText.substring(0, prev.length - 1)
          : fullText.substring(0, prev.length + 1)
      );

      setTypingSpeedState(isDeleting ? deletingSpeed : typingSpeed);

      if (!isDeleting && displayedText === fullText) {
        setTimeout(() => setIsDeleting(true), pauseDuration);
      } else if (isDeleting && displayedText === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeedState);

    return () => clearTimeout(timer);
  }, [
    displayedText,
    isDeleting,
    loopNum,
    text,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    typingSpeedState,
  ]);

  return (
    <span className={className}>
      {displayedText}
      {showCursor && (
        <span className={cursorClassName}>{cursorCharacter}</span>
      )}
    </span>
  );
}
