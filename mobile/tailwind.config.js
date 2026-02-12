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
          red: "#FFAB91",
          "red-dark": "#FF8A65",
          gold: "#FFCC80",
          "gold-dark": "#FFB74D",
          cream: "#FFF8E1",
          pink: "#F48FB1",
        },
      },
      fontFamily: {
        condensed: ["RobotoCondensed_700Bold"],
      },
    },
  },
  plugins: [],
};
