import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        paper: "#f7f6f1",
        line: "#d9d6ca",
        moss: "#4b6f44",
        rust: "#a85632",
        steel: "#4a6472"
      }
    }
  },
  plugins: []
};

export default config;
