class AuraEngine {
    constructor() {
        this.state = {
            localTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            targetTz: null,
            map: null,
            marker: null
        };
        this.init();
    }

    init() {
        this.state.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20, 0], 2);
        this.tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.state.map);
        this.state.map.on('click', (e) => this.sync(e.latlng.lat, e.latlng.lng));
        this.bind();
        this.loop();
    }

    async sync(lat, lon, label = null) {
        if (this.state.marker) this.state.map.removeLayer(this.state.marker);
        this.state.marker = L.circleMarker([lat, lon], { radius: 10, color: '#6366f1' }).addTo(this.state.map);
        
        document.getElementById('targetName').textContent = "SYNCING NODE...";

        try {
            // REDUNDANT SYNC SYSTEM
            const res = await fetch(`https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lon}&localityLanguage=en&key=free`);
            const data = await res.json();

            let name = label;
            if(!name) {
                const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const gData = await geo.json();
                name = gData.address.city || gData.address.country || "COORDINATE NODE";
            }

            // FAILSAFE: If API ID is missing, we calculate based on longitude
            this.state.targetTz = data.ianaTimeId || `Etc/GMT${lon >= 0 ? '-' : '+'}${Math.abs(Math.round(lon/15))}`;
            
            document.getElementById('targetName').textContent = name;
            document.getElementById('tzLabel').textContent = this.state.targetTz;
            document.getElementById('targetCard').classList.add('active');
            
        } catch (e) {
            document.getElementById('targetName').textContent = "DATA ERROR";
        }
    }

    loop() {
        setInterval(() => {
            const now = new Date();
            const opt = (tz) => ({ timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

            document.getElementById('localClock').textContent = now.toLocaleTimeString('en-US', opt(this.state.localTz));
            document.getElementById('localDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            if (this.state.targetTz) {
                try {
                    // This is where the time is pushed to the screen
                    const timeStr = now.toLocaleTimeString('en-US', opt(this.state.targetTz));
                    document.getElementById('targetClock').textContent = timeStr;
                    
                    const hr = parseInt(new Intl.DateTimeFormat('en-GB', {timeZone: this.state.targetTz, hour: 'numeric', hour12: false}).format(now));
                    document.getElementById('solarLabel').textContent = (hr >= 6 && hr < 18) ? "DAYLIGHT" : "NIGHTFALL";
                } catch (e) {
                    document.getElementById('targetClock').textContent = "FORMAT_ERR";
                }
            }
        }, 1000);
    }

    bind() {
        document.getElementById('syncBtn').onclick = () => {
            const val = document.getElementById('citySearch').value;
            if(val) this.search(val);
        };

        const inp = document.getElementById('citySearch');
        inp.oninput = async (e) => {
            if(e.target.value.length < 3) return;
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${e.target.value}`);
            const d = await r.json();
            document.getElementById('suggestions').innerHTML = d.slice(0,5).map(i => `
                <div class="item" onclick="engine.handleSelect(${i.lat}, ${i.lon}, '${i.display_name.split(',')[0]}')">${i.display_name}</div>
            `).join('');
        };
    }

    handleSelect(lat, lon, name) {
        document.getElementById('suggestions').innerHTML = "";
        document.getElementById('citySearch').value = "";
        this.state.map.flyTo([lat, lon], 10);
        this.sync(parseFloat(lat), parseFloat(lon), name);
    }
}

const engine = new AuraEngine();
