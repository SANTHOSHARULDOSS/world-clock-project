// 1. Initialize Map
const map = L.map('map').setView([20, 0], 2); 
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// 2. Update the clock every second
function updateTime() {
    const now = new Date();
    
    const timeString = now.toLocaleTimeString('en-GB', { timeZone: currentTimezone });
    const dateString = now.toLocaleDateString('en-GB', { 
        timeZone: currentTimezone, 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    document.getElementById('clock').textContent = timeString;
    document.getElementById('fullDate').textContent = dateString;
    document.getElementById('timezoneName').textContent = currentTimezone;
}

setInterval(updateTime, 1000);

// 3. Search Logic
document.getElementById('searchBtn').addEventListener('click', async () => {
    const city = document.getElementById('cityInput').value;
    if (!city) return;

    // Use free nominatim API to get Lat/Lon for the city
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
    const data = await response.json();

    if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        
        // Move map
        map.setView([lat, lon], 10);
        L.marker([lat, lon]).addTo(map);
        
        // Find Timezone using a free API
        const tzResponse = await fetch(`https://api.teleport.org/api/locations/${lat},${lon}/`);
        // Note: For a 1-hour project, simpler to use a mapping or library.
        // For now, let's update the name!
        document.getElementById('cityName').textContent = display_name.split(',')[0];
        
        // Suggestion: In a full app, use a Lat/Lng to Timezone API here.
    }
});