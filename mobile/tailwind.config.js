/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        tet: {
          red: "#B71C1C",
          "red-dark": "#8B0000",
          gold: "#FFD700",
          "gold-dark": "#DAA520",
          cream: "#FFF8E1",
          pink: "#FFCDD2",
        },
      },
      fontFamily: {
        condensed: ["RobotoCondensed_700Bold"],
      },
    },
  },
  plugins: [],
};
