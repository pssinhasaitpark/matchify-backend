import axios from "axios";

export const getPlaceName = async (lat, lon) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );

    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }

    return "Unknown Location"; 
  } catch (error) {
    console.error("Error fetching place name:", error.message);
    return "Unknown Location";
  }
};

//https://nominatim.openstreetmap.org/reverse?format=json&lat=22.6890071&lon=75.7885098