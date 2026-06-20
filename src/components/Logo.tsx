import React from 'react';

interface LogoProps {
  className?: string; // Tailwind class, e.g., "w-8 h-8"
  variant?: 'light' | 'dark' | 'brand' | 'red-square'; // dark = for light background, light = for dark background
}

export function NRLogo({ className = "w-8 h-8", variant = "dark" }: LogoProps) {
  // Choose colors based on light/dark context:
  // On light bg (dark variant), we use the precise dark navy: #0F1E36.
  // On dark bg (light variant), we use a sharp white/ice-blue to ensure maximum contrast and professional polish.
  const navyColor = variant === "light" ? "#F8FAFC" : "#0F1E36";
  const redColor = "#E5001A"; // Brand red

  if (variant === 'red-square') {
    return (
      <svg 
        viewBox="0 0 100 100" 
        className={className} 
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Red container background with rounded corners */}
        <rect width="100" height="100" rx="16" fill="#E5001A" />
        
        {/* Left "N" Shape in White */}
        <path 
          d="M 18,25 
             H 29 
             V 41 
             L 56.5,75 
             H 44.5 
             L 29,54 
             V 75 
             H 18 
             Z" 
          fill="#FFFFFF" 
        />

        {/* Right "R" Shape in White */}
        <path 
          d="M 44,25 
             H 74 
             C 84.5,25 91.5,31.5 91.5,41 
             C 91.5,50.5 84.5,57.5 74,57.5 
             H 54 
             L 71.5,75 
             H 84.5 
             L 67,57.5 
             H 74 
             C 84.5,57.5 91.5,50.5 91.5,41 
             C 91.5,31.5 84.5,25 74,25"
          fill="#FFFFFF"
          fillRule="evenodd"
          clipRule="evenodd"
        />
        
        {/* Inner capsule cutout of the "R" loop filled with same red to segment it */}
        <path
          d="M 54,35 
             H 72 
             C 75.5,35 78.5,37.5 78.5,41 
             C 78.5,44.5 75.5,47 72,47 
             H 54 
             Z"
          fill="#E5001A"
        />
      </svg>
    );
  }

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className} 
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Navy/Light Left "N" Shape */}
      <path 
        d="M 18,25 
           H 29 
           V 41 
           L 56.5,75 
           H 44.5 
           L 29,54 
           V 75 
           H 18 
           Z" 
        fill={navyColor} 
      />

      {/* Red Right "R" Shape */}
      <path 
        d="M 44,25 
           H 74 
           C 84.5,25 91.5,31.5 91.5,41 
           C 91.5,50.5 84.5,57.5 74,57.5 
           H 54 
           L 71.5,75 
           H 84.5 
           L 67,57.5 
           H 74 
           C 84.5,57.5 91.5,50.5 91.5,41 
           C 91.5,31.5 84.5,25 74,25"
        fill={redColor}
        fillRule="evenodd"
        clipRule="evenodd"
      />
      
      {/* Inner capsule cutout of the "R" loop */}
      <path
        d="M 54,35 
           H 72 
           C 75.5,35 78.5,37.5 78.5,41 
           C 78.5,44.5 75.5,47 72,47 
           H 54 
           Z"
        fill={redColor}
      />
    </svg>
  );
}

export default NRLogo;
