/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "primary-dark": "#52B69A",
        "primary-light": "#76C893",
        "secondary-dark": "#FFA92C",
        "secondary-light": "#FFC570",
        "neutral-dark": "#0C0C20",
        "neutral-light": "#F4F5F7",
        mute: "#D1D5DB33",
      },
      fontFamily: {
        HelveticaNeue: ["HelveticaNeue"],
      },
    },
  },
  plugins: [],
};
