"use client";
import React, { useState, useEffect } from 'react';
import './CardNav.css';

type CardNavLink = {
  label: string;
  href: string;
  ariaLabel: string;
  onClick?: () => void;
};

export type CardNavItem = {
  label: string;
  bgColor: string; // Ignored in Full Screen Mode
  textColor: string; // Ignored in Full Screen Mode
  links: CardNavLink[];
};

export interface CardNavProps {
  logo: string;
  logoAlt?: string;
  items: CardNavItem[];
  className?: string;
  baseColor?: string; // Ignored
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  hideNav?: boolean;
}

const CardNav: React.FC<CardNavProps> = ({
  logo,
  logoAlt = 'Logo',
  items,
  className = '',
  menuColor = '#fff',
  buttonBgColor = '#fff',
  buttonTextColor = '#000',
  ctaLabel = 'Get Started',
  onCtaClick,
  hideNav = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  const toggleMenu = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLinkClick = (e: React.MouseEvent, onClick?: () => void) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
    setIsExpanded(false);
  };

  return (
    <div className={`card-nav-container ${className} ${hideNav && !isExpanded ? 'hidden-nav' : ''}`}>
      <header className="card-nav-header">
        <div className="logo-wrapper">
             <img src={logo} alt={logoAlt} className="card-nav-logo" />
        </div>
       
        <div
          className={`hamburger-menu ${isExpanded ? 'open' : ''} transition-all active:scale-95`}
          onClick={toggleMenu}
          role="button"
          aria-label={isExpanded ? 'Close menu' : 'Open menu'}
          tabIndex={0}
        >
          <div className="hamburger-line" style={{ backgroundColor: menuColor }} />
          <div className="hamburger-line" style={{ backgroundColor: menuColor }} />
        </div>
      </header>

      <div className={`fullscreen-menu ${isExpanded ? 'open' : ''}`}>
        <div className="menu-content">
          {(items || []).map((group, idx) => (
            <div key={`${group.label}-${idx}`} className="menu-group">
              {group.links?.map((lnk, i) => (
                <a
                  key={`${lnk.label}-${i}`}
                  className="menu-link transition-all active:scale-95 inline-block"
                  href={lnk.href}
                  aria-label={lnk.ariaLabel}
                  onClick={(e) => handleLinkClick(e, lnk.onClick)}
                >
                  {lnk.label}
                </a>
              ))}
            </div>
          ))}

          {/* CTA Button is now inside the menu */}
          <div className="menu-cta-container">
            <button
              type="button"
              className="menu-cta-button rounded-full transition-all active:scale-95"
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              onClick={(e) => {
                  if (onCtaClick) onCtaClick();
                  setIsExpanded(false);
              }}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardNav;
