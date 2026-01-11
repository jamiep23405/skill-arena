import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Neon colors for game elements
        neon: {
          cyan: "hsl(var(--neon-cyan))",
          magenta: "hsl(var(--neon-magenta))",
          lime: "hsl(var(--neon-lime))",
          orange: "hsl(var(--neon-orange))",
          purple: "hsl(var(--neon-purple))",
          pink: "hsl(var(--neon-pink))",
          yellow: "hsl(var(--neon-yellow))",
          blue: "hsl(var(--neon-blue))",
        },
        game: {
          bg: "hsl(var(--game-bg))",
          grid: "hsl(var(--game-grid))",
        },
      },
      boxShadow: {
        "glow-cyan": "0 0 10px hsl(var(--neon-cyan)), 0 0 20px hsl(var(--neon-cyan) / 0.5), 0 0 40px hsl(var(--neon-cyan) / 0.3)",
        "glow-magenta": "0 0 10px hsl(var(--neon-magenta)), 0 0 20px hsl(var(--neon-magenta) / 0.5), 0 0 40px hsl(var(--neon-magenta) / 0.3)",
        "glow-lime": "0 0 10px hsl(var(--neon-lime)), 0 0 20px hsl(var(--neon-lime) / 0.5), 0 0 40px hsl(var(--neon-lime) / 0.3)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "snake-move": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "snake-move": "snake-move 3s linear infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
