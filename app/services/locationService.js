import axios from "axios";

// ✅ Extract city name only from reverse geocoding
export const getPlaceName = async (lat, lon) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`
    );

    const address = response.data?.address;
    if (address) {
      return (
        address.city ||
        address.town ||
        address.village ||
        address.suburb ||
        address.county ||
        address.state ||
        address.region ||
        address.country ||
        "Unknown"
      );
    }

    return "Unknown";
  } catch (error) {
    console.error("Error fetching place name:", error.message);
    return "Unknown";
  }
};


// ✅ Calculate distance between two geo points (Haversine formula)
export const calculateDistance = (loc1, loc2) => {
  if (!loc1?.coordinates || !loc2?.coordinates) return null;

  const [lon1, lat1] = loc1.coordinates;
  const [lon2, lat2] = loc2.coordinates;

  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in KM

  return Number(distance.toFixed(1));
};

// import axios from "axios";

// export const getPlaceName = async (lat, lon) => {
//   try {
//     const response = await axios.get(
//       `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
//     );

//     if (response.data && response.data.display_name) {
//       return response.data.display_name;
//     }

//     return "Unknown Location";
//   } catch (error) {
//     console.error("Error fetching place name:", error.message);
//     return "Unknown Location";
//   }
// };

//https://nominatim.openstreetmap.org/reverse?format=json&lat=22.6828226&lon=75.791812
