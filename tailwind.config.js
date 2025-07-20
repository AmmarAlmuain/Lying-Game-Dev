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
        "purple-pri": "#C94DFF",
        "green-sec": "#14D768",
        "orange-thi": "#FFAD44",
      },
      fontFamily: {
        // Marhey weights
        "marhey-light": ["Marhey_300Light"],
        "marhey-regular": ["Marhey_400Regular"],
        "marhey-medium": ["Marhey_500Medium"],
        "marhey-semibold": ["Marhey_600SemiBold"],
        "marhey-bold": ["Marhey_700Bold"],
        marhey: ["Marhey_400Regular"],
      },
    },
  },
  plugins: [],
};
